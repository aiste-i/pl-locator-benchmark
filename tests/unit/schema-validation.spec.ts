import { test, expect } from '@playwright/test';
import { validateBenchmarkPayload } from '../../src/benchmark/result-schema-validator';
import { BENCHMARK_DATASET_VERSION, BENCHMARK_SCHEMA_VERSION } from '../../src/benchmark/result-contract';

function validMinimalRecord(): any {
  return {
    schemaVersion: BENCHMARK_SCHEMA_VERSION,
    datasetVersion: BENCHMARK_DATASET_VERSION,
    generatedAt: '2026-04-10T00:00:00.000Z',
    commitSha: 'abc123',
    nodeVersion: 'v20.0.0',
    playwrightVersion: '1.58.2',
    benchmarkPackageVersion: '1.0.0',
    platform: {
      os: 'Linux',
      platform: 'linux',
      release: '6.0.0',
      arch: 'x64',
    },
    runId: 'run-1',
    applicationId: 'angular-realworld-example-app',
    browserName: 'chromium',
    browserChannel: null,
    scenarioId: 'Home loads [semantic-first]',
    locatorFamily: 'semantic-first',
    phase: 'baseline',
    mutation: {
      mutationId: 'baseline',
      operatorId: 'none',
      operatorCategory: 'none',
      candidateId: null,
      seed: null,
      phase: 'baseline',
      selected: false,
      applied: false,
      skipped: false,
      skipReason: null,
    },
    comparisonEligible: true,
    durationMs: 123,
    runStatus: 'passed',
    failureClass: null,
    failureStage: null,
    oracleIntegrityOk: true,
    evidence: {
      actionContextEntered: false,
      preActionResolutionObservation: 'unknown',
      uniquenessViolationObserved: false,
      actionAttemptStarted: false,
      actionCompleted: false,
      assertionStageEntered: false,
      oracleVerificationStarted: false,
      oracleVerificationCompleted: false,
      actionabilityFailureObserved: false,
      timeoutObserved: false,
      infrastructureFailureObserved: false,
      oracleIntegrityFailureObserved: false,
    },
    instrumentationPathUsed: 'fallback',
    accessibility: {
      scanAttempted: false,
      scanStatus: 'skipped',
      scanError: null,
      detailedArtifactWritten: false,
      artifactPath: null,
      totalViolations: 0,
      violationIds: [],
      impactedNodeCount: 0,
      criticalCount: 0,
      seriousCount: 0,
      moderateCount: 0,
      minorCount: 0,
      runId: 'run-1',
      applicationId: 'angular-realworld-example-app',
      browserName: 'chromium',
      scenarioId: 'Home loads [semantic-first]',
      phase: 'baseline',
      stabilization: {
        attempted: false,
        status: 'skipped',
        durationMs: 0,
        strategy: 'none',
      },
    },
  };
}

test('valid minimal benchmark record passes schema validation', () => {
  const result = validateBenchmarkPayload(validMinimalRecord());
  expect(result.valid).toBe(true);
  expect(result.errors).toEqual([]);
});

test('valid full benchmark record passes schema validation', () => {
  const record = validMinimalRecord();
  Object.assign(record, {
    gitBranch: 'main',
    dirtyWorkingTree: false,
    corpusId: 'realworld-active',
    activeScenarioId: 'health.home-load',
    activeScenarioCategory: 'load-visibility',
    sourceSpec: 'tests/realworld/health.spec.ts',
    semanticEntryPoint: 'role',
    changeId: 'candidate-1',
    changeCategory: 'content',
    changeOperator: 'TextReplace',
    quotaBucket: 'content',
    comparisonExclusionReason: null,
    rawErrorName: null,
    rawErrorMessage: null,
    classifierReason: null,
    isTimeout: false,
    isStrictnessViolation: false,
    invalidRunReason: null,
    oracleIntegrityError: null,
    tracePath: 'artifacts/run-1/trace.zip',
    screenshotPath: 'artifacts/run-1/screenshot.png',
    axeArtifactPath: 'test-results/app/axe.json',
    ariaSnapshotPath: null,
    metadataPath: 'artifacts/run-1/run-metadata.json',
    mutationTelemetry: {
      selectedCandidateId: 'candidate-1',
      selectedTargetSelector: '#title',
      selectedTargetTagType: 'h1',
      operatorRuntimeCategory: 'content',
      operatorThesisCategory: 'content',
      operatorConsideredCandidateCount: 10,
      operatorCandidateCount: 10,
      operatorApplicableCount: 4,
      operatorSkippedOracleCount: 1,
      operatorNotApplicableCount: 5,
      operatorSelectedCount: 1,
      operatorSelectedApplicableRatio: 0.25,
      operatorCheckDurationMs: 12,
      applyDurationMs: 3,
      applyFailureCount: 0,
      finalMutationOutcomeClass: 'applied',
    },
  });
  record.phase = 'mutated';
  record.mutation = {
    mutationId: 'candidate-1',
    operatorId: 'TextReplace',
    operatorCategory: 'content',
    candidateId: 'candidate-1',
    seed: 12345,
    phase: 'mutated',
    selected: true,
    applied: true,
    skipped: false,
    skipReason: null,
  };
  record.accessibility.scanAttempted = true;
  record.accessibility.scanStatus = 'completed';
  record.accessibility.scanTimestamp = '2026-04-10T00:00:01.000Z';
  record.accessibility.artifactPath = 'test-results/app/accessibility-artifacts/run-1_axe.json';
  record.accessibility.totalViolations = 1;
  record.accessibility.violationIds = ['color-contrast'];
  record.accessibility.impactedNodeCount = 2;
  record.accessibility.phase = 'mutated';
  record.accessibility.stabilization = {
    attempted: true,
    status: 'completed',
    durationMs: 205,
    strategy: 'networkidle + requestAnimationFrame + 200ms',
  };

  expect(validateBenchmarkPayload(record).valid).toBe(true);
});

test('missing required field fails schema validation', () => {
  const record = validMinimalRecord();
  delete record.runId;

  const result = validateBenchmarkPayload(record);
  expect(result.valid).toBe(false);
  expect(result.errors.some(error => error.message.includes("required property 'runId'"))).toBe(true);
});

test('invalid enum fails schema validation', () => {
  const record = validMinimalRecord();
  record.locatorFamily = 'oracle';

  const result = validateBenchmarkPayload(record);
  expect(result.valid).toBe(false);
  expect(result.errors.some(error => error.jsonPath.includes('locatorFamily') || error.message.includes('oneOf'))).toBe(true);
});

test('invalid nested accessibility object fails schema validation', () => {
  const record = validMinimalRecord();
  record.accessibility.scanStatus = 'partial';

  const result = validateBenchmarkPayload(record);
  expect(result.valid).toBe(false);
  expect(result.errors.some(error => error.jsonPath.includes('accessibility'))).toBe(true);
});

test('unknown extra property fails because result schema is strict', () => {
  const record = validMinimalRecord();
  record.untrackedConvenienceField = true;

  const result = validateBenchmarkPayload(record);
  expect(result.valid).toBe(false);
  expect(result.errors.some(error => error.message.includes('additional properties'))).toBe(true);
});
