import fs from 'fs';
import path from 'path';
import {
  REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
  REALWORLD_SEMANTIC_SUPPLEMENT_MANIFEST,
} from '../src/benchmark/realworld-corpus';
import { aggregate, loadResults } from '../src/benchmark/runner/aggregate';

type CoverageStatus = 'mutated-covered' | 'baseline-supported-no-valid-mutated-candidate';

interface ScenarioCoverageRow {
  scenarioId: string;
  status: CoverageStatus;
  selectedCandidateId: string | null;
  reason: string | null;
}

interface ScenarioFilePayload {
  metadata?: {
    applicationId?: string;
    corpusId?: string;
    seed?: number;
    budget?: number;
    semanticScenarioCoverage?: ScenarioCoverageRow[];
  };
}

interface GenerateOptions {
  resultsRoot?: string;
  outputDir?: string;
}

const CANONICAL_SUPPLEMENT_AGGREGATE_DIR = 'thesis-facing-aggregate';
const LEGACY_SUPPLEMENT_AGGREGATE_DIR = 'combined-aggregate';
const DEPRECATED_SUPPLEMENT_AGGREGATE_DIR = path.join('debug', 'deprecated-combined-aggregate');

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function expectedSupplementApps(): string[] {
  return Array.from(new Set(
    REALWORLD_SEMANTIC_SUPPLEMENT_MANIFEST.scenarios.flatMap(scenario => scenario.supportedApps),
  )).sort();
}

function supportedScenarioIdsForApp(appId: string): string[] {
  return REALWORLD_SEMANTIC_SUPPLEMENT_MANIFEST.scenarios
    .filter(scenario => scenario.supportedApps.includes(appId as any))
    .map(scenario => scenario.scenarioId)
    .sort();
}

function failIfAny(errors: string[]): void {
  if (errors.length > 0) {
    throw new Error([
      'Cannot generate thesis-facing semantic supplement aggregate because required supplement evidence is incomplete or polluted.',
      ...errors.map(error => `- ${error}`),
    ].join('\n'));
  }
}

function demoteLegacyCombinedAggregate(resultsRoot: string, outputDir: string): void {
  const legacyOutputDir = path.join(
    resultsRoot,
    REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
    LEGACY_SUPPLEMENT_AGGREGATE_DIR,
  );
  const deprecatedOutputDir = path.join(
    resultsRoot,
    REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
    DEPRECATED_SUPPLEMENT_AGGREGATE_DIR,
  );
  if (path.resolve(outputDir) === path.resolve(legacyOutputDir) || !fs.existsSync(legacyOutputDir)) {
    return;
  }

  fs.rmSync(deprecatedOutputDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(deprecatedOutputDir), { recursive: true });
  fs.renameSync(legacyOutputDir, deprecatedOutputDir);
  fs.writeFileSync(
    path.join(deprecatedOutputDir, 'NONCANONICAL_DEPRECATED_SUPPLEMENT_AGGREGATE.md'),
    [
      '# Deprecated Supplement Aggregate',
      '',
      'This directory was moved out of the thesis-facing supplement artifact path.',
      'Do not cite this aggregate in the thesis.',
      `Use ../../${CANONICAL_SUPPLEMENT_AGGREGATE_DIR}/ for the canonical semantic supplement aggregate.`,
      '',
    ].join('\n'),
  );
}

function writeCanonicalMarker(outputDir: string): void {
  fs.writeFileSync(
    path.join(outputDir, 'CANONICAL_THESIS_SUPPLEMENT_AGGREGATE.md'),
    [
      '# Canonical Thesis Supplement Aggregate',
      '',
      'This directory is the only thesis-facing aggregate for the supplementary semantic corpus.',
      'It contains supplementary semantic-first coverage evidence only.',
      'It is not pooled into the main RealWorld benchmark denominator and is not a second primary benchmark.',
      '',
      `Corpus: ${REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID}`,
      '',
    ].join('\n'),
  );
}

export function generateSemanticSupplementAggregate(options: GenerateOptions = {}): string {
  const resultsRoot = options.resultsRoot ?? path.join(process.cwd(), 'test-results');
  const outputDir = options.outputDir ?? path.join(
    resultsRoot,
    REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
    CANONICAL_SUPPLEMENT_AGGREGATE_DIR,
  );
  const expectedApps = expectedSupplementApps();
  const validSupplementScenarioIds = new Set(REALWORLD_SEMANTIC_SUPPLEMENT_MANIFEST.scenarios.map(scenario => scenario.scenarioId));
  const errors: string[] = [];
  const inputDirs: string[] = [];
  const scenarioPayloadsByApp = new Map<string, ScenarioFilePayload>();

  for (const appId of expectedApps) {
    const appRoot = path.join(resultsRoot, appId, REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID);
    const inputDir = path.join(appRoot, 'benchmark-runs');
    const scenarioPath = path.join(appRoot, 'scenarios.json');
    const requiredScenarioIds = supportedScenarioIdsForApp(appId);

    if (!fs.existsSync(inputDir)) {
      errors.push(`${appId} is missing supplement benchmark runs at ${inputDir}`);
    } else {
      inputDirs.push(inputDir);
    }

    if (!fs.existsSync(scenarioPath)) {
      errors.push(`${appId} is missing supplement scenarios metadata at ${scenarioPath}`);
      continue;
    }

    const payload = readJson<ScenarioFilePayload>(scenarioPath);
    scenarioPayloadsByApp.set(appId, payload);
    if (payload.metadata?.corpusId !== REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID) {
      errors.push(`${appId} scenarios.json has corpusId ${payload.metadata?.corpusId ?? 'missing'}, expected ${REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID}`);
    }

    const coverageRows = payload.metadata?.semanticScenarioCoverage;
    if (!Array.isArray(coverageRows) || coverageRows.length === 0) {
      errors.push(`${appId} scenarios.json is missing metadata.semanticScenarioCoverage`);
      continue;
    }

    const coverageByScenario = new Map(coverageRows.map(row => [row.scenarioId, row]));
    for (const scenarioId of requiredScenarioIds) {
      const row = coverageByScenario.get(scenarioId);
      if (!row) {
        errors.push(`${appId} is missing semanticScenarioCoverage for supported scenario ${scenarioId}`);
        continue;
      }
      if (row.status !== 'mutated-covered' && row.status !== 'baseline-supported-no-valid-mutated-candidate') {
        errors.push(`${appId} scenario ${scenarioId} has invalid supplement coverage status ${String(row.status)}`);
      }
      if (row.status === 'mutated-covered' && !row.selectedCandidateId) {
        errors.push(`${appId} scenario ${scenarioId} is mutated-covered but has no selectedCandidateId`);
      }
      if (row.status === 'baseline-supported-no-valid-mutated-candidate' && !row.reason) {
        errors.push(`${appId} scenario ${scenarioId} has no valid mutation candidate but no explicit reason`);
      }
    }

    for (const row of coverageRows) {
      if (!requiredScenarioIds.includes(row.scenarioId)) {
        errors.push(`${appId} scenarios.json contains coverage for unsupported or non-supplement scenario ${row.scenarioId}`);
      }
    }
  }

  failIfAny(errors);

  const runs = inputDirs.flatMap(inputDir => loadResults(inputDir));
  const loadedApps = new Set(runs.map(run => run.applicationId));

  for (const appId of expectedApps) {
    if (!loadedApps.has(appId)) {
      errors.push(`${appId} has no loaded benchmark result rows`);
    }
  }

  for (const run of runs) {
    if (run.corpusId !== REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID) {
      errors.push(`${run.applicationId} ${run.activeScenarioId} ${run.locatorFamily} includes non-supplement corpus ${run.corpusId}`);
    }
    if (!validSupplementScenarioIds.has(run.activeScenarioId)) {
      errors.push(`${run.applicationId} includes non-supplement scenario ${run.activeScenarioId}`);
    }
    if (!expectedApps.includes(run.applicationId)) {
      errors.push(`Unexpected app ${run.applicationId} appears in supplement benchmark runs`);
    }
  }

  const semanticFirstRows = runs.filter(run => run.locatorFamily === 'semantic-first');
  const eligibleMutatedSemanticRows = semanticFirstRows.filter(run => run.phase === 'mutated' && run.comparisonEligible);

  for (const appId of expectedApps) {
    const coverageRows = scenarioPayloadsByApp.get(appId)?.metadata?.semanticScenarioCoverage ?? [];
    const coverageByScenario = new Map(coverageRows.map(row => [row.scenarioId, row]));

    for (const scenarioId of supportedScenarioIdsForApp(appId)) {
      const baselineRows = semanticFirstRows.filter(run =>
        run.applicationId === appId &&
        run.activeScenarioId === scenarioId &&
        run.phase === 'baseline' &&
        run.runStatus === 'passed',
      );
      const mutatedRows = eligibleMutatedSemanticRows.filter(run =>
        run.applicationId === appId &&
        run.activeScenarioId === scenarioId,
      );
      const coverage = coverageByScenario.get(scenarioId);

      if (baselineRows.length === 0) {
        errors.push(`${appId} ${scenarioId} has no passed semantic-first baseline row`);
      }

      if (coverage?.status === 'mutated-covered' && mutatedRows.length === 0) {
        errors.push(`${appId} ${scenarioId} is marked mutated-covered but has no comparison-eligible mutated semantic-first row`);
      }

      if (coverage?.status === 'baseline-supported-no-valid-mutated-candidate' && mutatedRows.length > 0) {
        errors.push(`${appId} ${scenarioId} is marked no-valid-mutated-candidate but has comparison-eligible mutated semantic-first evidence`);
      }
    }
  }

  if (runs.length === 0) {
    errors.push(`No ${REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID} runs found in: ${inputDirs.join(', ')}`);
  }

  failIfAny(errors);

  demoteLegacyCombinedAggregate(resultsRoot, outputDir);
  fs.rmSync(outputDir, { recursive: true, force: true });

  aggregate(semanticFirstRows, outputDir, {
    supplementResultsRoot: resultsRoot,
    supplementExpectedApps: expectedApps,
    thesisFacingSemanticSupplement: true,
    supplementDiagnosticRowCounts: {
      nonSemanticSupplementRowsExcluded: runs.length - semanticFirstRows.length,
      nonSupplementRowsExcluded: 0,
    },
  });
  writeCanonicalMarker(outputDir);
  console.log(`Combined semantic supplement aggregate written to ${outputDir}`);
  return outputDir;
}

function main() {
  generateSemanticSupplementAggregate();
}

if (require.main === module) {
  main();
}
