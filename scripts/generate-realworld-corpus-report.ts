import fs from 'fs';
import path from 'path';
import {
  REALWORLD_CORPUS_MANIFEST,
  getActiveScenarioEntries,
  getExcludedScenarioEntries,
  getSourceSpecDispositions,
} from '../src/benchmark/realworld-corpus';

function main() {
  const reportsDir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const activeScenarios = getActiveScenarioEntries().map(entry => ({
    scenarioId: entry.scenarioId,
    displayName: entry.displayName,
    sourceSpec: entry.sourceSpec,
    category: entry.category,
    requiresAuth: entry.requiresAuth,
    usesSetupData: entry.usesSetupData,
    logicalKeys: entry.logicalKeys,
  }));

  const excludedScenarios = getExcludedScenarioEntries().map(entry => ({
    scenarioId: entry.scenarioId,
    displayName: entry.displayName,
    sourceSpec: entry.sourceSpec,
    status: entry.status,
    reason: entry.reason,
  }));

  const sourceSpecs = getSourceSpecDispositions().map(disposition => ({
    sourceSpec: disposition.sourceSpec,
    status: disposition.status,
    rationale: disposition.rationale,
    activeScenarioIds: disposition.activeScenarioIds,
    excludedCoverage: disposition.excludedCoverage,
  }));

  const corpusReport = {
    corpusId: REALWORLD_CORPUS_MANIFEST.corpusId,
    displayName: REALWORLD_CORPUS_MANIFEST.displayName,
    entrySpec: REALWORLD_CORPUS_MANIFEST.entrySpec,
    validationFiles: REALWORLD_CORPUS_MANIFEST.validationFiles,
    activeScenarioCount: activeScenarios.length,
    activeScenarios,
    excludedScenarios,
    sourceSpecMatrix: sourceSpecs,
    policy: {
      activeCorpusSelection: 'migrated-comparable-scenarios-only',
      temporaryMigrationDebtRemaining: false,
      unsupportedHandling: 'visible-in-reports-without-cross-family-fallback',
      primaryClaimBoundary: 'The thesis-active dataset is the benchmark-active shared corpus executed in the primary controlled environment.',
    },
  };

  fs.writeFileSync(
    path.join(reportsDir, 'realworld-benchmark-corpus.json'),
    JSON.stringify(corpusReport, null, 2),
  );
}

main();
