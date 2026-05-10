import { test as base, expect, Locator, Page } from '@playwright/test';
import { MutantGenerator } from '../src/benchmark/runner/MutantGenerator';
import { WebMutator } from '../src/webmutator/WebMutator';
import { MutationCandidate } from '../src/webmutator/MutationCandidate';
import { MutationRecord } from '../src/webmutator/MutationRecord';
import { StrategyName, STRATEGIES, getAppLocators, getAppOracle } from '../src/locators';
import { FailureClassifier, ExecutionStage, FailureClass, ClassificationResult, StructuredEvidence } from '../src/webmutator/utils/FailureClassifier';
import { BenchmarkedLocator, OracleLocator, InstrumentationContext, resolveFactoryScope } from '../src/locators/BenchmarkedLocator';
import { AxeBuilder } from '@axe-core/playwright';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { createHash } from 'crypto';
import { AppAdapter } from '../src/apps/types';
import { getAppResultsDir, getSelectedAppAdapter } from '../src/apps';
import { getBenchmarkCorpusId, getBenchmarkCorpusRole, usesDeferredMutation } from '../src/benchmark/realworld-corpus';
import {
    BENCHMARK_DATASET_VERSION,
    BENCHMARK_SCHEMA_VERSION,
    createRunMetadata,
    flattenResultForCsv,
    inferExecutionMode,
    writeCsvRows,
} from '../src/benchmark/result-contract';
import {
    getBenchmarkRetention,
    shouldWriteDetailedAccessibilityArtifacts,
    shouldWriteMirroredRunArtifacts,
} from '../src/benchmark/retention';
import { getCandidateCategory } from '../src/benchmark/runner/sampling';

const BENCHMARK_ACTIVE_MODE = process.env.BENCHMARK_ACTIVE_MODE || 'baseline';

// Define custom options for our tests
export type TestOptions = {
  locatorStrategy: StrategyName;
  mutation?: MutationCandidate;
};

export type AccessibilityScanStatus = 'completed' | 'failed' | 'skipped';

export interface StabilizationMetadata {
    attempted: boolean;
    status: 'completed' | 'timeout-fallback' | 'skipped';
    durationMs: number;
    strategy: string;
}

export interface AccessibilitySummary {
  scanAttempted: boolean;
  scanStatus: AccessibilityScanStatus;
  scanTimestamp?: string;
  scanError?: string | null;
  detailedArtifactWritten: boolean;
  artifactPath: string | null;
  totalViolations: number;
  violationIds: string[];
  impactedNodeCount: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  // Metadata linkage duplicated here for unambiguous joins if files are separated
  runId: string;
  applicationId: string;
  browserName: string;
  scenarioId: string;
  phase: 'baseline' | 'mutated';
  stabilization: StabilizationMetadata;
}

export interface MutationMetadataSummary {
  mutationId: string;
  operatorId: string;
  operatorCategory: 'none' | 'structural' | 'content' | 'accessibility-semantic' | 'visibility' | 'visibility-interaction-state';
  candidateId: string | null;
  seed: number | null;
  phase: 'baseline' | 'mutated';
  selected: boolean;
  applied: boolean;
  skipped: boolean;
  skipReason: string | null;
}

export interface BenchmarkResult {
  schemaVersion: string;
  datasetVersion: string;
  generatedAt: string;
  commitSha: string;
  gitBranch: string | null;
  dirtyWorkingTree: boolean | null;
  nodeVersion: string;
  playwrightVersion: string;
  benchmarkPackageVersion: string | null;
  platform: {
    os: string;
    platform: string;
    release: string;
    arch: string;
  };
  runId: string;
  applicationId: string;
  browserName: string;
  browserChannel: string | null;
  corpusId?: string;
  corpusRole?: string;
  scenarioId: string;
  activeScenarioId?: string;
  activeScenarioCategory?: string;
  sourceSpec?: string;
  intendedSemanticEntryPoint?: string | null;
  actualSemanticEntryPoint?: string | null;
  targetLogicalKeys?: string[];
  semanticScenarioSupportedApps?: string[];
  semanticScenarioExclusionReason?: string | null;
  locatorFamily: string;
  semanticEntryPoint?: string;
  phase: 'baseline' | 'mutated';
  mutation: MutationMetadataSummary;
  changeId?: string;
  changeCategory?: string;
  changeOperator?: string;
  quotaBucket?: string;
  comparisonEligible?: boolean;
  comparisonExclusionReason?: string | null;
  durationMs: number;
  runStatus: 'passed' | 'failed' | 'invalid';
  failureClass: FailureClass | null;
  failureStage: ExecutionStage | null;
  rawErrorName?: string;
  rawErrorMessage?: string;
  classifierReason?: string;
  isTimeout?: boolean;
  isStrictnessViolation?: boolean;
  invalidRunReason?: string;
  oracleIntegrityOk: boolean;
  oracleIntegrityError?: string;
  evidence: StructuredEvidence;
  instrumentationPathUsed: 'structured' | 'fallback' | 'mixed';
  accessibility: AccessibilitySummary;
  tracePath?: string | null;
  screenshotPath?: string | null;
  axeArtifactPath?: string | null;
  ariaSnapshotPath?: string | null;
  metadataPath?: string | null;
  mutationTelemetry?: {
    selectedCandidateId: string | null;
    selectedTargetSelector: string | null;
    selectedTargetTagType: string | null;
    operatorRuntimeCategory: string | null;
    operatorThesisCategory: string | null;
    operatorConsideredCandidateCount: number | null;
    operatorCandidateCount: number | null;
    operatorApplicableCount: number | null;
    operatorSkippedOracleCount: number | null;
    operatorNotApplicableCount: number | null;
    operatorSelectedCount: number | null;
    operatorSelectedApplicableRatio: number | null;
    operatorCheckDurationMs: number | null;
    applyDurationMs: number | null;
    applyFailureCount: number;
    finalMutationOutcomeClass: string | null;
  };
}

/**
 * Stabilization helper to ensure the page is in a consistent end state before scanning.
 */
async function stabilizePage(page: Page): Promise<StabilizationMetadata> {
    const start = Date.now();
    let status: 'completed' | 'timeout-fallback' | 'skipped' = 'completed';
    
    // 1. Wait for network to be idle
    try {
        await page.waitForLoadState('networkidle', { timeout: 2000 });
    } catch (e) {
        status = 'timeout-fallback';
    }
    
    // 2. Wait for any pending animations/rendering (heuristic)
    try {
        await page.evaluate(() => new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))));
    } catch (e) {
        status = 'timeout-fallback';
    }
    
    // 3. Buffer for microtasks
    await page.waitForTimeout(200); 

    return {
        attempted: true,
        status: status,
        durationMs: Date.now() - start,
        strategy: 'networkidle + requestAnimationFrame + 200ms'
    };
}

function createArtifactStem(scenarioId: string, runId: string): string {
    const normalized = scenarioId.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const compact = normalized.slice(0, 80).replace(/_+/g, '_');
    const digest = createHash('sha1').update(scenarioId).digest('hex').slice(0, 10);
    return `${compact}_${digest}_${runId}`;
}

function parseOptionalInteger(value: string | undefined): number | null {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function classifyMutationSkipReason(error: string | undefined): string | null {
    if (!error) return null;
    if (error.includes('oracle-protected')) return 'oracle-protected';
    if (error.includes('target-not-found') || error.includes('Element not found')) return 'target-not-found';
    if (error.includes('behavior-preservation-gate-failed')) return 'behavior-preservation-gate-failed';
    if (error.includes('operator-applicability-error')) return 'operator-applicability-error';
    if (error.includes('Deferred mutation was never applied')) return 'checkpoint-not-reached';
    return 'apply-failed';
}

function classifyMutationOutcome(record: MutationRecord): string {
    if (record.success) return 'applied';
    return classifyMutationSkipReason(record.error) ?? 'apply-failed';
}

// Extend base test with custom options and fixtures
export const test = base.extend<TestOptions & { 
    benchmarkResult: BenchmarkResult,
    appAdapter: AppAdapter,
    setScenarioMetadata: (metadata: {
      activeScenarioId: string;
      activeScenarioCategory: string;
      sourceSpec: string;
      corpusRole?: string;
      intendedSemanticEntryPoint?: string | null;
      targetLogicalKeys?: string[];
      semanticScenarioSupportedApps?: string[];
      semanticScenarioExclusionReason?: string | null;
    }) => void,
    runAction: (action: () => Promise<any>, locator?: Locator) => Promise<any>,
    runAssertion: (assertion: () => Promise<any>) => Promise<any>,
    runOraclePrecheck: (precheck: () => Promise<any>) => Promise<any>,
    applyDeferredMutation: (scenarioId: string, viewContext: string) => Promise<void>,
    locators: any,
    oracle: any
}>({
  // Default locator strategy
  locatorStrategy: ['semantic-first', { option: true }],
  // Optional mutation candidate
  mutation: [undefined, { option: true }],

  benchmarkResult: [{} as any, { option: true }],

  appAdapter: async ({}, use) => {
    await use(getSelectedAppAdapter());
  },

  setScenarioMetadata: async ({ benchmarkResult }, use) => {
    const setScenarioMetadata = (metadata: {
      activeScenarioId: string;
      activeScenarioCategory: string;
      sourceSpec: string;
      corpusRole?: string;
      intendedSemanticEntryPoint?: string | null;
      targetLogicalKeys?: string[];
      semanticScenarioSupportedApps?: string[];
      semanticScenarioExclusionReason?: string | null;
    }) => {
      benchmarkResult.activeScenarioId = metadata.activeScenarioId;
      benchmarkResult.activeScenarioCategory = metadata.activeScenarioCategory;
      benchmarkResult.sourceSpec = metadata.sourceSpec;
      benchmarkResult.corpusRole = metadata.corpusRole ?? benchmarkResult.corpusRole;
      benchmarkResult.intendedSemanticEntryPoint = metadata.intendedSemanticEntryPoint ?? null;
      benchmarkResult.targetLogicalKeys = metadata.targetLogicalKeys ?? [];
      benchmarkResult.semanticScenarioSupportedApps = metadata.semanticScenarioSupportedApps ?? [];
      benchmarkResult.semanticScenarioExclusionReason = metadata.semanticScenarioExclusionReason ?? null;
    };
    await use(setScenarioMetadata);
  },

  runOraclePrecheck: async ({ benchmarkResult }, use) => {
    const runOraclePrecheck = async (precheck: () => Promise<any>) => {
        benchmarkResult.instrumentationPathUsed = 'structured';
        try {
            return await precheck();
        } catch (error: any) {
            benchmarkResult.oracleIntegrityOk = false;
            benchmarkResult.oracleIntegrityError = error.message;
            const classification = FailureClassifier.classify(error, ExecutionStage.ORACLE_PRECHECK, benchmarkResult.evidence);
            Object.assign(benchmarkResult, classification);
            throw error;
        }
    };
    await use(runOraclePrecheck);
  },

  runAction: async ({ benchmarkResult }, use) => {
    const runAction = async (action: () => Promise<any>, locator?: Locator) => {
        benchmarkResult.instrumentationPathUsed = 'structured';
        benchmarkResult.evidence.actionContextEntered = true;
        if (locator) {
            if ((locator as any).semanticEntryPoint) {
                const semanticEntryPoint = (locator as any).semanticEntryPoint;
                benchmarkResult.semanticEntryPoint = semanticEntryPoint;
                benchmarkResult.actualSemanticEntryPoint = semanticEntryPoint;
            }
            try {
                const count = await locator.count();
                benchmarkResult.evidence.preActionResolutionObservation = count;
            } catch (e) {
                benchmarkResult.evidence.preActionResolutionObservation = 0;
            }
        }
        
        try {
            benchmarkResult.evidence.actionAttemptStarted = true;
            const result = await action();
            benchmarkResult.evidence.actionCompleted = true;
            return result;
        } catch (error) {
            const classification = FailureClassifier.classify(error, ExecutionStage.ACTION, benchmarkResult.evidence);
            Object.assign(benchmarkResult, classification);
            throw error; 
        }
    };
    await use(runAction);
  },

  runAssertion: async ({ benchmarkResult }, use) => {
    const runAssertion = async (assertion: () => Promise<any>) => {
        benchmarkResult.instrumentationPathUsed = 'structured';
        benchmarkResult.evidence.assertionStageEntered = true;
        try {
            benchmarkResult.evidence.oracleVerificationStarted = true;
            const result = await assertion();
            benchmarkResult.evidence.oracleVerificationCompleted = true;
            return result;
        } catch (error) {
            const classification = FailureClassifier.classify(error, ExecutionStage.ASSERTION, benchmarkResult.evidence);
            Object.assign(benchmarkResult, classification);
            throw error;
        }
    };
    await use(runAssertion);
  },

  applyDeferredMutation: async ({ page, mutation, benchmarkResult }, use) => {
    let applied = false;

    const applyDeferredMutation = async (scenarioId: string, viewContext: string) => {
      if (!mutation || applied) {
        return;
      }

      if (mutation.scenarioId !== scenarioId || mutation.viewContext !== viewContext) {
        return;
      }

      const mutator = new WebMutator();
      const startedAt = Date.now();
      const record = await mutator.applyMutation(page, mutation.selector, mutation.operator);
      const applyDurationMs = Date.now() - startedAt;
      mutation.record = record;
      applied = true;
      benchmarkResult.mutation.applied = record.success;
      benchmarkResult.mutation.skipped = !record.success;
      benchmarkResult.mutation.skipReason = classifyMutationSkipReason(record.error);
      if (benchmarkResult.mutationTelemetry) {
        benchmarkResult.mutationTelemetry.applyDurationMs = applyDurationMs;
        benchmarkResult.mutationTelemetry.applyFailureCount = record.success ? 0 : 1;
        benchmarkResult.mutationTelemetry.finalMutationOutcomeClass = classifyMutationOutcome(record);
      }

      if (!record.success) {
        benchmarkResult.runStatus = 'invalid';
        benchmarkResult.invalidRunReason = record.error ?? 'Mutation skipped or failed during deferred application';
        benchmarkResult.comparisonEligible = false;
        benchmarkResult.comparisonExclusionReason = record.error ?? 'Mutation skipped or failed during deferred application';
        benchmarkResult.accessibility.scanStatus = 'skipped';
      }
    };

    await use(applyDeferredMutation);

    if (
      mutation &&
      usesDeferredMutation() &&
      benchmarkResult.activeScenarioId === mutation.scenarioId &&
      !applied &&
      benchmarkResult.runStatus === 'passed'
    ) {
      benchmarkResult.runStatus = 'invalid';
      benchmarkResult.invalidRunReason = `Deferred mutation was never applied for checkpoint ${mutation.viewContext}`;
      benchmarkResult.comparisonEligible = false;
      benchmarkResult.comparisonExclusionReason = benchmarkResult.invalidRunReason;
      benchmarkResult.accessibility.scanStatus = 'skipped';
      benchmarkResult.mutation.skipped = true;
      benchmarkResult.mutation.skipReason = 'checkpoint-not-reached';
      if (benchmarkResult.mutationTelemetry) {
        benchmarkResult.mutationTelemetry.applyFailureCount = 1;
        benchmarkResult.mutationTelemetry.finalMutationOutcomeClass = 'checkpoint-not-reached';
      }
    }
  },

  locators: async ({ page, locatorStrategy, runAction, runAssertion, runOraclePrecheck, appAdapter }: any, use: any) => {
    const context: InstrumentationContext = { runAction, runAssertion, runOraclePrecheck };
    const rawLocators = getAppLocators(appAdapter, locatorStrategy);

    const wrapLocators = (node: any): any => {
      if (typeof node === 'function') {
        return (...args: any[]) => {
          const { scope, remainingArgs } = resolveFactoryScope(page, args);
          return new BenchmarkedLocator(node(scope, ...remainingArgs), context);
        };
      }
      if (!node || typeof node !== 'object') {
        return node;
      }
      return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, wrapLocators(value)]));
    };

    const wrapped = wrapLocators(rawLocators);
    await use(wrapped);
  },

  oracle: async ({ page, runAction, runAssertion, runOraclePrecheck, appAdapter }: any, use: any) => {
    const context: InstrumentationContext = { runAction, runAssertion, runOraclePrecheck };
    const rawOracle = getAppOracle(appAdapter);
    const wrapOracle = (node: any): any => {
      if (typeof node === 'function') {
        return (...args: any[]) => {
          const { scope, remainingArgs } = resolveFactoryScope(page, args);
          return new OracleLocator(node(scope, ...remainingArgs), context);
        };
      }
      if (!node || typeof node !== 'object') {
        return node;
      }
      return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, wrapOracle(value)]));
    };
    const wrapped = wrapOracle(rawOracle);
    await use(wrapped);
  },

  page: async ({ page, locatorStrategy, mutation, benchmarkResult, appAdapter }, use, testInfo) => {
    const appName = appAdapter.id;
    const projectUse = testInfo.project.use as { browserName?: string; channel?: string };
    const browserName = projectUse.browserName || testInfo.project.metadata.browserName || 'chromium';
    const browserChannel = projectUse.channel ?? null;

    const scenarioId = testInfo.titlePath.join(' > ');
    const runId = uuidv4();
    const phase = mutation ? 'mutated' : 'baseline';
    const mutationCategory = mutation ? getCandidateCategory(mutation) : 'none';
    const generatedAt = new Date().toISOString();
    const startTime = Date.now();
    const mutationBudget = parseOptionalInteger(process.env.BENCHMARK_BUDGET || process.env.npm_config_budget);
    const mutationSeed = mutation?.selectionSeed ?? parseOptionalInteger(process.env.BENCHMARK_SEED || process.env.npm_config_seed);
    const retention = getBenchmarkRetention();
    const runMetadata = createRunMetadata({
        runId,
        generatedAt,
        applicationId: appName,
        browserName,
        browserChannel,
        corpusId: getBenchmarkCorpusId(),
        seed: mutationSeed,
        mutationBudget,
        selectedMutationIds: mutation?.candidateId ? [mutation.candidateId] : [],
        totalCandidatesConsidered: mutation?.operatorCandidateCount ?? null,
        executionMode: inferExecutionMode(phase),
    });

    // Initialize benchmark result with runId and empty accessibility status
    Object.assign(benchmarkResult, {
        schemaVersion: BENCHMARK_SCHEMA_VERSION,
        datasetVersion: BENCHMARK_DATASET_VERSION,
        generatedAt,
        commitSha: runMetadata.commitSha,
        gitBranch: runMetadata.gitBranch,
        dirtyWorkingTree: runMetadata.dirtyWorkingTree,
        nodeVersion: runMetadata.nodeVersion,
        playwrightVersion: runMetadata.playwrightVersion,
        benchmarkPackageVersion: runMetadata.benchmarkPackageVersion,
        platform: runMetadata.platform,
        runId: runId,
        applicationId: appName,
        browserName,
        browserChannel,
        corpusId: getBenchmarkCorpusId(),
        corpusRole: getBenchmarkCorpusRole(),
        scenarioId: scenarioId,
        activeScenarioId: undefined,
        activeScenarioCategory: undefined,
        sourceSpec: undefined,
        intendedSemanticEntryPoint: null,
        actualSemanticEntryPoint: null,
        targetLogicalKeys: [],
        semanticScenarioSupportedApps: [],
        semanticScenarioExclusionReason: null,
        locatorFamily: locatorStrategy,
        phase: phase,
        mutation: {
            mutationId: mutation?.candidateId || 'baseline',
            operatorId: mutation ? mutation.operator.constructor.name : 'none',
            operatorCategory: mutationCategory,
            candidateId: mutation?.candidateId ?? null,
            seed: mutationSeed,
            phase,
            selected: Boolean(mutation),
            applied: false,
            skipped: false,
            skipReason: null,
        },
        comparisonEligible: true,
        durationMs: 0,
        runStatus: 'passed',
        failureClass: null,
        failureStage: null,
        oracleIntegrityOk: true,
        evidence: FailureClassifier.createEmptyEvidence(),
        instrumentationPathUsed: 'fallback',
        tracePath: null,
        screenshotPath: null,
        axeArtifactPath: null,
        ariaSnapshotPath: null,
        metadataPath: null,
        mutationTelemetry: undefined,
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
            runId: runId,
            applicationId: appName,
            browserName,
            scenarioId: scenarioId,
            phase: phase,
            stabilization: {
                attempted: false,
                status: 'skipped',
                durationMs: 0,
                strategy: 'none'
            }
        }
    });

    if (mutation) {
        benchmarkResult.changeId = mutation.candidateId || mutation.selector;
        benchmarkResult.changeOperator = mutation.operator.constructor.name;
        benchmarkResult.changeCategory = mutationCategory;
        benchmarkResult.quotaBucket = mutation.quotaBucket ?? mutationCategory;
        benchmarkResult.comparisonEligible = mutation.aggregateComparisonEligible !== false;
        benchmarkResult.comparisonExclusionReason = mutation.comparisonExclusionReason;
        benchmarkResult.mutationTelemetry = {
            selectedCandidateId: mutation.candidateId ?? null,
            selectedTargetSelector: mutation.selector ?? null,
            selectedTargetTagType: mutation.fingerprint?.tagType ?? null,
            operatorRuntimeCategory: mutation.operatorRuntimeCategory ?? mutationCategory,
            operatorThesisCategory: mutation.operatorThesisCategory ?? mutation.operator.category,
            operatorConsideredCandidateCount: mutation.operatorCandidateCount ?? null,
            operatorCandidateCount: mutation.operatorCandidateCount ?? null,
            operatorApplicableCount: mutation.operatorApplicableCount ?? null,
            operatorSkippedOracleCount: mutation.operatorSkippedOracleCount ?? null,
            operatorNotApplicableCount: mutation.operatorNotApplicableCount ?? null,
            operatorSelectedCount: mutation.operatorSelectedCount ?? null,
            operatorSelectedApplicableRatio: mutation.operatorSelectedApplicableRatio ?? null,
            operatorCheckDurationMs: mutation.operatorTotalCheckDurationMs ?? null,
            applyDurationMs: null,
            applyFailureCount: 0,
            finalMutationOutcomeClass: null,
        };
        if (!usesDeferredMutation()) {
            await page.goto('/'); 
            const mutator = new WebMutator();
            try {
                const startedAt = Date.now();
                const record = await mutator.applyMutation(page, mutation.selector, mutation.operator);
                const applyDurationMs = Date.now() - startedAt;
                mutation.record = record;
                benchmarkResult.mutation.applied = record.success;
                benchmarkResult.mutation.skipped = !record.success;
                benchmarkResult.mutation.skipReason = classifyMutationSkipReason(record.error);
                if (benchmarkResult.mutationTelemetry) {
                    benchmarkResult.mutationTelemetry.applyDurationMs = applyDurationMs;
                    benchmarkResult.mutationTelemetry.applyFailureCount = record.success ? 0 : 1;
                    benchmarkResult.mutationTelemetry.finalMutationOutcomeClass = classifyMutationOutcome(record);
                }
                if (!record.success) {
                    benchmarkResult.runStatus = 'invalid';
                    benchmarkResult.invalidRunReason = record.error ?? 'Mutation skipped or failed during application';
                    benchmarkResult.comparisonEligible = false;
                    benchmarkResult.comparisonExclusionReason = record.error ?? 'Mutation skipped or failed during application';
                    benchmarkResult.accessibility.scanStatus = 'skipped';
                }
            } catch (error: any) {
                benchmarkResult.runStatus = 'invalid';
                benchmarkResult.invalidRunReason = 'Setup failure during mutation application: ' + error.message;
                benchmarkResult.accessibility.scanStatus = 'skipped';
                benchmarkResult.mutation.skipped = true;
                benchmarkResult.mutation.skipReason = 'setup-failure';
                if (benchmarkResult.mutationTelemetry) {
                    benchmarkResult.mutationTelemetry.applyFailureCount = 1;
                    benchmarkResult.mutationTelemetry.finalMutationOutcomeClass = 'setup-failure';
                }
                throw error;
            }
        }
    }

    const benchmarkMutationExecution = BENCHMARK_ACTIVE_MODE === 'mutate' && Boolean(mutation);

    try {
        await use(page);
    } catch (error) {
        if (benchmarkResult.runStatus === 'passed') {
             const classification = FailureClassifier.classify(error, ExecutionStage.ACTION, benchmarkResult.evidence);
             Object.assign(benchmarkResult, classification);
             benchmarkResult.instrumentationPathUsed = benchmarkResult.instrumentationPathUsed === 'fallback' ? 'fallback' : 'mixed';
        }

        if (!benchmarkMutationExecution) {
            throw error;
        }
    } finally {
        benchmarkResult.durationMs = Date.now() - startTime;
        if (BENCHMARK_ACTIVE_MODE === 'preflight') {
            return;
        }
        // Run accessibility scan at the end of the scenario
        // Policy: Skip scan if the page was never correctly navigated or crashed early
        const skipScan =
            benchmarkResult.runStatus === 'invalid' &&
            (benchmarkResult.invalidRunReason?.includes('Setup failure') ||
             benchmarkResult.invalidRunReason?.includes('Mutation skipped'));
        
        if (!skipScan) {
            try {
                benchmarkResult.accessibility.scanAttempted = true;
                
                // 1. Stabilization
                const stabMetadata = await stabilizePage(page);
                benchmarkResult.accessibility.stabilization = stabMetadata;
                
                // 2. Scan
                const results = await new AxeBuilder({ page }).analyze();
                
                // 3. Populate Summary
                Object.assign(benchmarkResult.accessibility, {
                    scanStatus: 'completed',
                    scanTimestamp: new Date().toISOString(),
                    totalViolations: results.violations.length,
                    violationIds: results.violations.map(v => v.id),
                    impactedNodeCount: results.violations.reduce((acc, v) => acc + v.nodes.length, 0),
                    criticalCount: results.violations.filter(v => v.impact === 'critical').length,
                    seriousCount: results.violations.filter(v => v.impact === 'serious').length,
                    moderateCount: results.violations.filter(v => v.impact === 'moderate').length,
                    minorCount: results.violations.filter(v => v.impact === 'minor').length
                });

                // 4. Persist Detailed Artifact
                const artifactsDir = path.join(getAppResultsDir(appName as any), 'accessibility-artifacts');
                if (shouldWriteDetailedAccessibilityArtifacts(retention)) {
                    if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

                    const artifactStem = createArtifactStem(benchmarkResult.activeScenarioId || scenarioId, runId);
                    const artifactName = `${artifactStem}_axe.json`;
                    const artifactPath = path.join(artifactsDir, artifactName);

                    // Full mirrored metadata for standalone artifact consumption
                    const artifactContent = {
                        metadata: {
                            schemaVersion: BENCHMARK_SCHEMA_VERSION,
                            datasetVersion: BENCHMARK_DATASET_VERSION,
                            runId: runId,
                            applicationId: appName,
                            browserName,
                            browserChannel,
                            scenarioId: scenarioId,
                            locatorFamily: locatorStrategy,
                            semanticEntryPoint: benchmarkResult.semanticEntryPoint,
                            phase: phase,
                            changeId: benchmarkResult.changeId,
                            changeCategory: benchmarkResult.changeCategory,
                            changeOperator: benchmarkResult.changeOperator,
                            scanStatus: benchmarkResult.accessibility.scanStatus,
                            scanTimestamp: benchmarkResult.accessibility.scanTimestamp,
                            benchmarkRunStatus: benchmarkResult.runStatus,
                            formatVersion: '1.1.0'
                        },
                        axeResults: results
                    };

                    fs.writeFileSync(artifactPath, JSON.stringify(artifactContent, null, 2));

                    // 5. Normalize Path (POSIX relative)
                    benchmarkResult.accessibility.artifactPath = path.relative(process.cwd(), artifactPath).split(path.sep).join('/');
                    benchmarkResult.axeArtifactPath = benchmarkResult.accessibility.artifactPath;
                    benchmarkResult.accessibility.detailedArtifactWritten = true;
                }
                
            } catch (axeError: any) {
                benchmarkResult.accessibility.scanStatus = 'failed';
                benchmarkResult.accessibility.scanError = axeError.message;
                console.error(`Accessibility scan failed for run ${runId}:`, axeError.message);
            }
        } else {
            benchmarkResult.accessibility.scanStatus = 'skipped';
        }

        // Save main benchmark result
        const resultsDir = path.join(getAppResultsDir(appName as any), 'benchmark-runs');
        if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
        const artifactStem = createArtifactStem(benchmarkResult.activeScenarioId || scenarioId, runId);
        const resultPath = path.join(resultsDir, `${artifactStem}.json`);
        const finalizedRunMetadata = {
            ...runMetadata,
            selectedScenarios: benchmarkResult.activeScenarioId ? [benchmarkResult.activeScenarioId] : runMetadata.selectedScenarios,
            selectedMutationIds: mutation?.candidateId ? [mutation.candidateId] : [],
            totalCandidatesConsidered: mutation?.operatorCandidateCount ?? runMetadata.totalCandidatesConsidered,
        };

        if (shouldWriteMirroredRunArtifacts(retention)) {
            const metadataPath = path.join(process.cwd(), 'artifacts', runId, 'run-metadata.json');
            benchmarkResult.metadataPath = path.relative(process.cwd(), metadataPath).split(path.sep).join('/');
        }
        fs.writeFileSync(resultPath, JSON.stringify(benchmarkResult, null, 2));
        if (shouldWriteMirroredRunArtifacts(retention)) {
            const rootArtifactDir = path.join(process.cwd(), 'artifacts', runId);
            if (!fs.existsSync(rootArtifactDir)) fs.mkdirSync(rootArtifactDir, { recursive: true });
            const metadataPath = path.join(rootArtifactDir, 'run-metadata.json');
            const rootResultsJsonPath = path.join(rootArtifactDir, 'results.json');
            const rootResultsCsvPath = path.join(rootArtifactDir, 'results.csv');
            benchmarkResult.metadataPath = path.relative(process.cwd(), metadataPath).split(path.sep).join('/');
            fs.writeFileSync(metadataPath, JSON.stringify(finalizedRunMetadata, null, 2));
            fs.writeFileSync(rootResultsJsonPath, JSON.stringify(benchmarkResult, null, 2));
            writeCsvRows(rootResultsCsvPath, [flattenResultForCsv(benchmarkResult)]);
        }
    }
  },
});

export { expect };
