import fs from 'fs';
import path from 'path';
import { REALWORLD_APP_IDS, getAppAdapter } from '../../apps';
import type { SupportedAppId } from '../../apps/types';
import {
  REALWORLD_CORPUS_MANIFEST,
  type RealWorldScenarioEntry,
} from '../../benchmark/realworld-corpus';
import type { StrategyName } from '..';
import {
  getByLogicalKey,
  getLocatorMeta,
  type LocatorFamily,
  type LocatorPurity,
  type LocatorSourceKind,
} from '../apps/shared-realworld';

export type CoverageFamily = LocatorFamily;

export interface CoverageOverride {
  app: string;
  logicalKey: string;
  family: CoverageFamily;
  reason: string;
  excludedFromAggregateComparison: boolean;
  specHints?: string[];
}

export interface SupportMatrixRow {
  app: string;
  logicalKey: string;
  family: CoverageFamily;
  supported: boolean;
  reason: string | null;
  excludedFromAggregateComparison: boolean;
  aggregateComparisonEligible: boolean;
  activeInCorpus: boolean;
  activeScenarioIds: string[];
  specHints: string[];
  sourceKind: LocatorSourceKind | null;
  purity: LocatorPurity | null;
  semanticEntryPoint: string | null;
  isException: boolean;
  selector: string | null;
}

export interface SemanticCssExceptionRow {
  appId: string;
  logicalKey: string;
  reason: string;
  cssSelector: string;
  activeInCorpus: boolean;
  affectsFairComparisonWording: boolean;
}

export const COVERAGE_OVERRIDES: CoverageOverride[] = [];

function collectReferencedLogicalKeys(): Map<string, { activeScenarioIds: Set<string>; sourceSpecs: Set<string>; activeInCorpus: boolean }> {
  const byKey = new Map<string, { activeScenarioIds: Set<string>; sourceSpecs: Set<string>; activeInCorpus: boolean }>();

  const registerEntry = (entry: RealWorldScenarioEntry, activeInCorpus: boolean) => {
    for (const logicalKey of entry.logicalKeys) {
      if (!byKey.has(logicalKey)) {
        byKey.set(logicalKey, {
          activeScenarioIds: new Set<string>(),
          sourceSpecs: new Set<string>(),
          activeInCorpus,
        });
      }
      const bucket = byKey.get(logicalKey)!;
      bucket.sourceSpecs.add(entry.sourceSpec);
      if (entry.status === 'active') {
        bucket.activeScenarioIds.add(entry.scenarioId);
      }
      bucket.activeInCorpus = bucket.activeInCorpus || activeInCorpus;
    }
  };

  for (const entry of REALWORLD_CORPUS_MANIFEST.scenarios) {
    registerEntry(entry, entry.status === 'active');
  }

  return byKey;
}

function getLocatorTree(appId: SupportedAppId, family: CoverageFamily): Record<string, unknown> {
  const adapter = getAppAdapter(appId);
  if (family === 'oracle') {
    return adapter.getOracle();
  }
  return adapter.getLocators(family as StrategyName);
}

function resolveSupportRow(
  appId: SupportedAppId,
  family: CoverageFamily,
  logicalKey: string,
  activeInCorpus: boolean,
  activeScenarioIds: string[],
  specHints: string[],
  overrideMap: Map<string, CoverageOverride>,
): SupportMatrixRow {
  const override = overrideMap.get(`${appId}::${logicalKey}::${family}`);
  if (override) {
    return {
      app: appId,
      logicalKey,
      family,
      supported: false,
      reason: override.reason,
      excludedFromAggregateComparison: override.excludedFromAggregateComparison,
      aggregateComparisonEligible: false,
      activeInCorpus,
      activeScenarioIds,
      specHints: override.specHints?.length ? override.specHints : specHints,
      sourceKind: null,
      purity: null,
      semanticEntryPoint: null,
      isException: false,
      selector: null,
    };
  }

  const locatorTree = getLocatorTree(appId, family);
  const factory = getByLogicalKey(locatorTree, logicalKey);
  const meta = getLocatorMeta(factory);

  if (typeof factory !== 'function') {
    return {
      app: appId,
      logicalKey,
      family,
      supported: false,
      reason: `Missing ${family} locator implementation for ${logicalKey} in ${appId}.`,
      excludedFromAggregateComparison: false,
      aggregateComparisonEligible: false,
      activeInCorpus,
      activeScenarioIds,
      specHints,
      sourceKind: null,
      purity: null,
      semanticEntryPoint: null,
      isException: false,
      selector: null,
    };
  }

  if (!meta) {
    return {
      app: appId,
      logicalKey,
      family,
      supported: false,
      reason: `Missing family metadata for ${logicalKey} in ${appId} ${family}.`,
      excludedFromAggregateComparison: false,
      aggregateComparisonEligible: false,
      activeInCorpus,
      activeScenarioIds,
      specHints,
      sourceKind: null,
      purity: null,
      semanticEntryPoint: null,
      isException: false,
      selector: null,
    };
  }

  return {
    app: appId,
    logicalKey,
    family,
    supported: meta.family === family,
    reason: meta.family === family ? null : `Family metadata mismatch for ${logicalKey}: expected ${family}, got ${meta.family}.`,
    excludedFromAggregateComparison: false,
    aggregateComparisonEligible: false,
    activeInCorpus,
    activeScenarioIds,
    specHints,
    sourceKind: meta.sourceKind,
    purity: meta.purity,
    semanticEntryPoint: meta.semanticEntryPoint ?? null,
    isException: meta.isException,
    selector: meta.selector ?? null,
  };
}

export function generateSupportMatrix(): SupportMatrixRow[] {
  const referencedKeys = collectReferencedLogicalKeys();
  const families: CoverageFamily[] = ['semantic-first', 'css', 'xpath', 'oracle'];
  const benchmarkFamilies: CoverageFamily[] = ['semantic-first', 'css', 'xpath'];
  const overrideMap = new Map(
    COVERAGE_OVERRIDES.map(override => [`${override.app}::${override.logicalKey}::${override.family}`, override]),
  );

  const rows: SupportMatrixRow[] = [];

  for (const app of REALWORLD_APP_IDS) {
    for (const [logicalKey, metadata] of referencedKeys.entries()) {
      const specHints = [...metadata.sourceSpecs].sort();
      const activeScenarioIds = [...metadata.activeScenarioIds].sort();

      for (const family of families) {
        rows.push(resolveSupportRow(app, family, logicalKey, metadata.activeInCorpus, activeScenarioIds, specHints, overrideMap));
      }
    }
  }

  const aggregateEligibility = new Map<string, boolean>();
  for (const app of REALWORLD_APP_IDS) {
    for (const logicalKey of referencedKeys.keys()) {
      const benchmarkRows = rows.filter(row => row.app === app && row.logicalKey === logicalKey && benchmarkFamilies.includes(row.family));
      aggregateEligibility.set(
        `${app}::${logicalKey}`,
        benchmarkRows.length === benchmarkFamilies.length && benchmarkRows.every(row => row.supported),
      );
    }
  }

  return rows.map(row => ({
    ...row,
    aggregateComparisonEligible: row.activeInCorpus ? aggregateEligibility.get(`${row.app}::${row.logicalKey}`) ?? false : false,
  }));
}

export function generateSemanticCssExceptionReport(): SemanticCssExceptionRow[] {
  const referencedKeys = collectReferencedLogicalKeys();
  const rows: SemanticCssExceptionRow[] = [];

  for (const app of REALWORLD_APP_IDS) {
    const locators = getLocatorTree(app, 'semantic-first');
    for (const logicalKey of referencedKeys.keys()) {
      const meta = getLocatorMeta(getByLogicalKey(locators, logicalKey));
      if (meta?.sourceKind !== 'semantic-css-exception' || !meta.exception) {
        continue;
      }

      rows.push({
        appId: app,
        logicalKey,
        reason: meta.exception.reason,
        cssSelector: meta.exception.cssSelector,
        activeInCorpus: meta.exception.activeInCorpus,
        affectsFairComparisonWording: meta.exception.affectsFairComparisonWording,
      });
    }
  }

  return rows.sort((left, right) => `${left.appId}:${left.logicalKey}`.localeCompare(`${right.appId}:${right.logicalKey}`));
}

export function writeCoverageReports(rows: SupportMatrixRow[]): void {
  const reportsDir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  fs.writeFileSync(path.join(reportsDir, 'realworld-locator-support-matrix.json'), JSON.stringify(rows, null, 2));
  fs.writeFileSync(
    path.join(reportsDir, 'realworld-locator-unsupported.json'),
    JSON.stringify(rows.filter(row => !row.supported), null, 2),
  );
  fs.writeFileSync(
    path.join(reportsDir, 'realworld-semantic-css-exceptions.json'),
    JSON.stringify(generateSemanticCssExceptionReport(), null, 2),
  );
}
