import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import { REALWORLD_APP_IDS, getAppAdapter } from '../../src/apps';
import {
  REALWORLD_ACTIVE_CORPUS_ID,
  REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
  REALWORLD_SEMANTIC_SUPPLEMENT_MANIFEST,
  getActiveScenarioEntries,
  getSemanticSupplementExcludedPairs,
  getSemanticSupplementScenarioEntries,
} from '../../src/benchmark/realworld-corpus';
import { STRATEGIES } from '../../src/locators';
import {
  getByLogicalKey,
  getLocatorMeta,
  type LocatorFamilyMeta,
} from '../../src/locators/apps/shared-realworld';

const EXPECTED_ACTIVE_SCENARIO_IDS = [
  'health.home-load',
  'auth.sign-in-valid',
  'feed.open-global-feed',
  'article.open-from-feed',
  'comments.add-on-article',
  'settings.update-bio',
  'article.favorite-from-detail',
  'article.preview-description-visibility',
  'comments.delete-own',
  'article.assert-title',
  'navigation.pagination',
  'social.follow-unfollow',
];

function getRawLocatorTree(appId: (typeof REALWORLD_APP_IDS)[number], family: (typeof STRATEGIES)[number] | 'oracle') {
  const adapter = getAppAdapter(appId);
  return family === 'oracle' ? adapter.getOracle() : adapter.getLocators(family);
}

function getMetaOrThrow(appId: string, family: string, logicalKey: string): LocatorFamilyMeta {
  const factory = getByLogicalKey(getRawLocatorTree(appId as any, family as any), logicalKey);
  expect(typeof factory, `${appId} ${family} ${logicalKey} is missing`).toBe('function');
  const meta = getLocatorMeta(factory);
  expect(meta, `${appId} ${family} ${logicalKey} is missing family metadata`).toBeTruthy();
  return meta!;
}

test('primary realworld-active scenario ids remain unchanged', async () => {
  expect(REALWORLD_ACTIVE_CORPUS_ID).toBe('realworld-active');
  expect(getActiveScenarioEntries().map(entry => entry.scenarioId)).toEqual(EXPECTED_ACTIVE_SCENARIO_IDS);
});

test('semantic supplement manifest is small, explicit, and supplementary only', async () => {
  const scenarios = getSemanticSupplementScenarioEntries();
  expect(REALWORLD_SEMANTIC_SUPPLEMENT_MANIFEST.corpusId).toBe(REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID);
  expect(REALWORLD_SEMANTIC_SUPPLEMENT_MANIFEST.corpusRole).toBe('supplementary');
  expect(REALWORLD_SEMANTIC_SUPPLEMENT_MANIFEST.interpretationBoundary).toContain('not pooled');
  expect(scenarios.length).toBeGreaterThanOrEqual(4);
  expect(scenarios.length).toBeLessThanOrEqual(6);

  for (const scenario of scenarios) {
    expect(scenario.corpusRole).toBe('supplementary');
    expect(scenario.intendedSemanticEntryPoint).toMatch(/^getBy/);
    expect(scenario.targetLogicalKeys.length).toBeGreaterThan(0);
    expect(scenario.fallbackPolicy).toBe('exclude-if-intended-query-unavailable');
    expect(scenario.semanticNaturalnessRationale.length).toBeGreaterThan(0);
    expect(scenario.supplementRationale.length).toBeGreaterThan(0);

    const supported = new Set(scenario.supportedApps);
    const excluded = new Set(scenario.excludedApps.map(app => app.appId));
    expect([...supported].some(app => excluded.has(app))).toBe(false);
    expect([...supported, ...excluded].sort()).toEqual([...REALWORLD_APP_IDS].sort());
  }
});

test('supplementary scenarios cover underrepresented semantic entry points without getByRole fallback', async () => {
  const scenarios = getSemanticSupplementScenarioEntries();
  const intendedEntryPoints = new Set(scenarios.map(scenario => scenario.intendedSemanticEntryPoint));

  expect(intendedEntryPoints).toEqual(new Set(['getByLabel', 'getByPlaceholder', 'getByText', 'getByAltText']));
  expect(intendedEntryPoints.has('getByRole')).toBe(false);
  expect(intendedEntryPoints.has('getByTitle')).toBe(false);
  expect(scenarios.some(scenario => scenario.getByTitleOmissionRationale)).toBe(true);
});

test('unsupported supplementary app/scenario pairs are machine reported', async () => {
  const excludedPairs = getSemanticSupplementExcludedPairs();
  expect(excludedPairs).toEqual(expect.arrayContaining([
    expect.objectContaining({ scenarioId: 'semantic.auth-email-label', appId: 'angular-realworld-example-app' }),
    expect.objectContaining({ scenarioId: 'semantic.auth-email-label', appId: 'realworld' }),
    expect.objectContaining({ scenarioId: 'semantic.profile-avatar-alt', appId: 'angular-realworld-example-app' }),
  ]));
  expect(excludedPairs.every(pair => pair.reason.length > 0)).toBe(true);
});

test('supported supplementary semantic locators expose the intended semantic entry point', async () => {
  for (const scenario of getSemanticSupplementScenarioEntries()) {
    for (const appId of scenario.supportedApps) {
      for (const logicalKey of scenario.targetLogicalKeys) {
        const semanticMeta = getMetaOrThrow(appId, 'semantic-first', logicalKey);
        expect(semanticMeta.sourceKind).toBe('semantic-native');
        expect(semanticMeta.rootKind).toBe('semantic-entrypoint');
        expect(semanticMeta.semanticEntryPoint).toBe(scenario.intendedSemanticEntryPoint);

        for (const family of ['css', 'xpath', 'oracle'] as const) {
          const meta = getMetaOrThrow(appId, family, logicalKey);
          expect(meta.family).toBe(family);
        }
      }
    }
  }
});

test('supplementary benchmark files stay on logical locators and keep getByTestId oracle-only', async () => {
  const supplementFiles = [
    'tests/realworld/benchmark-semantic-supplement.spec.ts',
    'tests/realworld/benchmark-semantic-supplement.scenarios.ts',
  ];
  const forbiddenPatterns = [
    'page.locator(',
    'page.getByRole(',
    'page.getByText(',
    'page.getByPlaceholder(',
    'page.getByLabel(',
    'page.getByAltText(',
    'page.getByTitle(',
    'page.getByTestId(',
  ];

  for (const relativePath of supplementFiles) {
    const contents = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
    for (const pattern of forbiddenPatterns) {
      expect(contents.includes(pattern), `${relativePath} should not bypass logical locator interfaces with ${pattern}`).toBe(false);
    }
  }

  for (const scenario of getSemanticSupplementScenarioEntries()) {
    for (const appId of scenario.supportedApps) {
      for (const logicalKey of scenario.targetLogicalKeys) {
        for (const family of STRATEGIES) {
          const meta = getMetaOrThrow(appId, family, logicalKey);
          expect(meta.selector ?? '').not.toContain('data-testid');
        }
        expect(getMetaOrThrow(appId, 'oracle', logicalKey).rootKind).toBe('getByTestId');
      }
    }
  }
});

test('semantic supplement source reports are generated and machine-readable', async () => {
  const auditPath = path.join(process.cwd(), 'reports', 'realworld-semantic-target-audit.json');
  const corpusPath = path.join(process.cwd(), 'reports', 'realworld-semantic-supplement-corpus.json');
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8')) as {
    corpusRole: string;
    notPooledIntoPrimaryDenominators: boolean;
    queryDistributionBySupportedAppScenarioPair: Record<string, number>;
  };
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8')) as {
    corpusId: string;
    corpusRole: string;
    denominatorPolicy: string;
  };

  expect(audit.corpusRole).toBe('supplementary');
  expect(audit.notPooledIntoPrimaryDenominators).toBe(true);
  expect(audit.queryDistributionBySupportedAppScenarioPair.getByLabel).toBeGreaterThan(0);
  expect(audit.queryDistributionBySupportedAppScenarioPair.getByText).toBeGreaterThan(0);
  expect(audit.queryDistributionBySupportedAppScenarioPair.getByPlaceholder).toBeGreaterThan(0);
  expect(audit.queryDistributionBySupportedAppScenarioPair.getByAltText).toBeGreaterThan(0);
  expect(corpus.corpusId).toBe(REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID);
  expect(corpus.corpusRole).toBe('supplementary');
  expect(corpus.denominatorPolicy).toContain('not pooled');
});
