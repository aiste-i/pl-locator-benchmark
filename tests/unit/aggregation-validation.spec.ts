import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BENCHMARK_DATASET_VERSION, BENCHMARK_SCHEMA_VERSION } from '../../src/benchmark/result-contract';
import {
    REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
    REALWORLD_SEMANTIC_SUPPLEMENT_MANIFEST,
} from '../../src/benchmark/realworld-corpus';
import { TextReplace } from '../../src/webmutator/operators/dom/TextReplace';
import { generateSemanticSupplementAggregate } from '../../scripts/generate-semantic-supplement-aggregate';
import {
    demoteLegacySupplementAppAggregate,
    getDefaultAggregateOutputDir,
} from '../../src/benchmark/runner/aggregate';
import { MutationCandidate } from '../../src/webmutator/MutationCandidate';

function makeMutationTelemetry(overrides: Record<string, unknown> = {}) {
    return {
        selectedCandidateId: null,
        selectedTargetSelector: null,
        selectedTargetTagType: null,
        operatorRuntimeCategory: null,
        operatorThesisCategory: null,
        operatorConsideredCandidateCount: null,
        operatorCandidateCount: null,
        operatorApplicableCount: null,
        operatorSkippedOracleCount: null,
        operatorNotApplicableCount: null,
        operatorSelectedCount: null,
        operatorSelectedApplicableRatio: null,
        operatorCheckDurationMs: null,
        applyDurationMs: null,
        applyFailureCount: 0,
        finalMutationOutcomeClass: null,
        ...overrides,
    };
}

function makeBenchmarkRun(overrides: Record<string, unknown> = {}) {
    const basePhase = (overrides.phase as 'baseline' | 'mutated' | undefined) ?? 'baseline';
    const baseRunStatus = (overrides.runStatus as 'passed' | 'failed' | 'invalid' | undefined) ?? 'passed';
    const runId = (overrides.runId as string | undefined) ?? uuidv4();

    const record = {
        schemaVersion: BENCHMARK_SCHEMA_VERSION,
        datasetVersion: BENCHMARK_DATASET_VERSION,
        generatedAt: '2026-04-21T00:00:00.000Z',
        commitSha: 'abc123',
        gitBranch: 'main',
        dirtyWorkingTree: false,
        nodeVersion: 'v22.21.1',
        playwrightVersion: '1.58.2',
        benchmarkPackageVersion: '1.0.0',
        platform: {
            os: 'Windows',
            platform: 'win32',
            release: '10.0.0',
            arch: 'x64',
        },
        runId,
        applicationId: 'angular-realworld-example-app',
        browserName: 'chromium',
        browserChannel: null,
        corpusId: 'realworld-active',
        scenarioId: 'health.home-load [semantic-first]',
        activeScenarioId: 'health.home-load',
        activeScenarioCategory: 'load-visibility',
        sourceSpec: 'tests/realworld/health.spec.ts',
        locatorFamily: 'semantic-first',
        semanticEntryPoint: null,
        phase: basePhase,
        mutation: {
            mutationId: basePhase === 'baseline' ? 'baseline' : 'candidate-1',
            operatorId: basePhase === 'baseline' ? 'none' : 'TextReplace',
            operatorCategory: basePhase === 'baseline' ? 'none' : 'content',
            candidateId: basePhase === 'baseline' ? null : 'candidate-1',
            seed: basePhase === 'baseline' ? null : 12345,
            phase: basePhase,
            selected: basePhase === 'mutated',
            applied: false,
            skipped: false,
            skipReason: null,
        },
        changeId: basePhase === 'baseline' ? null : 'candidate-1',
        changeCategory: basePhase === 'baseline' ? null : 'content',
        changeOperator: basePhase === 'baseline' ? null : 'TextReplace',
        quotaBucket: basePhase === 'baseline' ? null : 'content',
        comparisonEligible: true,
        comparisonExclusionReason: null,
        durationMs: 100,
        runStatus: baseRunStatus,
        failureClass: baseRunStatus === 'failed' ? 'ASSERTION' : null,
        failureStage: baseRunStatus === 'failed' ? 'ASSERTION' : null,
        rawErrorName: null,
        rawErrorMessage: null,
        classifierReason: null,
        isTimeout: false,
        isStrictnessViolation: false,
        invalidRunReason: baseRunStatus === 'invalid' ? 'setup-failure' : null,
        oracleIntegrityOk: true,
        oracleIntegrityError: null,
        evidence: {
            actionContextEntered: true,
            preActionResolutionObservation: 1,
            uniquenessViolationObserved: false,
            actionAttemptStarted: true,
            actionCompleted: baseRunStatus !== 'invalid',
            assertionStageEntered: true,
            oracleVerificationStarted: true,
            oracleVerificationCompleted: baseRunStatus !== 'invalid',
            actionabilityFailureObserved: false,
            timeoutObserved: false,
            infrastructureFailureObserved: false,
            oracleIntegrityFailureObserved: false,
        },
        instrumentationPathUsed: 'fallback',
        accessibility: {
            scanAttempted: false,
            scanStatus: 'skipped',
            scanTimestamp: null,
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
            runId,
            applicationId: 'angular-realworld-example-app',
            browserName: 'chromium',
            scenarioId: 'health.home-load [semantic-first]',
            phase: basePhase,
            stabilization: {
                attempted: false,
                status: 'skipped',
                durationMs: 0,
                strategy: 'none',
            },
        },
        tracePath: null,
        screenshotPath: null,
        axeArtifactPath: null,
        ariaSnapshotPath: null,
        metadataPath: null,
        ...overrides,
    } as any;

    record.accessibility = {
        ...record.accessibility,
        ...(overrides.accessibility as Record<string, unknown> | undefined),
        runId: record.runId,
        applicationId: record.applicationId,
        browserName: record.browserName,
        scenarioId: record.scenarioId,
        phase: record.phase,
    };

    if (record.mutationTelemetry) {
        record.mutationTelemetry = makeMutationTelemetry(record.mutationTelemetry);
    }

    if (record.phase === 'mutated') {
        record.mutation = {
            ...record.mutation,
            phase: 'mutated',
            selected: true,
            candidateId: record.changeId,
            mutationId: record.changeId,
        };
    } else {
        record.mutation = {
            ...record.mutation,
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
        };
        record.changeId = null;
        record.changeCategory = null;
        record.changeOperator = null;
        record.quotaBucket = null;
        record.mutationTelemetry = undefined;
    }

    if (record.runStatus === 'failed' && !record.failureClass) {
        record.failureClass = 'ASSERTION';
        record.failureStage = 'ASSERTION';
    }

    if (record.runStatus === 'invalid') {
        record.failureClass = null;
        record.failureStage = null;
        record.invalidRunReason = record.invalidRunReason ?? 'setup-failure';
    }

    return record;
}

function getExpectedSupplementApps(): string[] {
    return Array.from(new Set(
        REALWORLD_SEMANTIC_SUPPLEMENT_MANIFEST.scenarios.flatMap(scenario => scenario.supportedApps),
    )).sort();
}

function writeCompleteSupplementFixture(resultsRoot: string, overrides: {
    omitApps?: string[];
    corruptFirstRunCorpus?: boolean;
    noValidCoverage?: Record<string, string[]>;
    invalidMutationCoverage?: Record<string, string[]>;
} = {}) {
    const omittedApps = new Set(overrides.omitApps ?? []);

    for (const appId of getExpectedSupplementApps()) {
        if (omittedApps.has(appId)) continue;

        const appRoot = path.join(resultsRoot, appId, REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID);
        const runsDir = path.join(appRoot, 'benchmark-runs');
        fs.mkdirSync(runsDir, { recursive: true });

        const supportedScenarios = REALWORLD_SEMANTIC_SUPPLEMENT_MANIFEST.scenarios.filter(scenario =>
            scenario.supportedApps.includes(appId as any),
        );
        const noValidScenarios = new Set([
            ...(overrides.noValidCoverage?.[appId] ?? []),
            ...(overrides.invalidMutationCoverage?.[appId] ?? []),
        ]);
        const coverage = supportedScenarios.map(scenario => ({
            scenarioId: scenario.scenarioId,
            status: noValidScenarios.has(scenario.scenarioId)
                ? 'baseline-supported-no-valid-mutated-candidate'
                : 'mutated-covered',
            selectedCandidateId: noValidScenarios.has(scenario.scenarioId)
                ? null
                : `${appId}-${scenario.scenarioId}-candidate`,
            reason: noValidScenarios.has(scenario.scenarioId)
                ? 'no eligible validated mutation candidate for supported supplement scenario'
                : null,
        }));

        fs.writeFileSync(path.join(appRoot, 'scenarios.json'), JSON.stringify({
            metadata: {
                applicationId: appId,
                corpusId: REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
                seed: 12345,
                budget: supportedScenarios.length,
                semanticScenarioCoverage: coverage,
            },
            scenarios: [],
        }, null, 2));

        supportedScenarios.forEach((scenario, scenarioIndex) => {
            const runBase = {
                applicationId: appId,
                browserName: 'chromium',
                corpusId: REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
                corpusRole: 'supplementary',
                activeScenarioId: scenario.scenarioId,
                scenarioId: `${scenario.scenarioId} [semantic-first]`,
                activeScenarioCategory: scenario.category,
                sourceSpec: scenario.sourceSpec,
                intendedSemanticEntryPoint: scenario.intendedSemanticEntryPoint,
                actualSemanticEntryPoint: scenario.intendedSemanticEntryPoint,
                targetLogicalKeys: scenario.targetLogicalKeys,
                semanticScenarioSupportedApps: scenario.supportedApps,
            };
            const baseline = makeBenchmarkRun({
                ...runBase,
                locatorFamily: 'semantic-first',
                phase: 'baseline',
                runStatus: 'passed',
                corpusId: overrides.corruptFirstRunCorpus && appId === getExpectedSupplementApps()[0] && scenarioIndex === 0
                    ? 'realworld-active'
                    : REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
            });
            const mutated = makeBenchmarkRun({
                ...runBase,
                locatorFamily: 'semantic-first',
                phase: 'mutated',
                runStatus: noValidScenarios.has(scenario.scenarioId) ? 'invalid' : 'passed',
                comparisonEligible: !noValidScenarios.has(scenario.scenarioId),
                comparisonExclusionReason: noValidScenarios.has(scenario.scenarioId)
                    ? 'Mutation selected but not applied during supplement execution'
                    : null,
                invalidRunReason: noValidScenarios.has(scenario.scenarioId)
                    ? 'Mutation selected but not applied during supplement execution'
                    : null,
                changeId: `${appId}-${scenario.scenarioId}-candidate`,
                changeOperator: 'TextReplace',
                changeCategory: 'content',
                quotaBucket: 'content',
                mutationTelemetry: {
                    selectedCandidateId: `${appId}-${scenario.scenarioId}-candidate`,
                    finalMutationOutcomeClass: noValidScenarios.has(scenario.scenarioId) ? 'not-applied' : 'applied',
                    applyFailureCount: noValidScenarios.has(scenario.scenarioId) ? 1 : 0,
                },
            });
            const cssBaseline = makeBenchmarkRun({
                ...runBase,
                locatorFamily: 'css',
                actualSemanticEntryPoint: null,
                phase: 'baseline',
                runStatus: 'passed',
            });

            fs.writeFileSync(path.join(runsDir, `${scenario.scenarioId.replace(/\./g, '_')}_baseline.json`), JSON.stringify(baseline));
            if (!((overrides.noValidCoverage?.[appId] ?? []).includes(scenario.scenarioId))) {
                fs.writeFileSync(path.join(runsDir, `${scenario.scenarioId.replace(/\./g, '_')}_mutated.json`), JSON.stringify(mutated));
            }
            fs.writeFileSync(path.join(runsDir, `${scenario.scenarioId.replace(/\./g, '_')}_css.json`), JSON.stringify(cssBaseline));
        });
    }
}

function readCsvRows(filePath: string): Record<string, string>[] {
    const text = fs.readFileSync(filePath, 'utf8').trim();
    if (!text) return [];
    const [headerLine, ...lines] = text.split(/\r?\n/);
    const headers = headerLine.split(',');
    return lines.map(line => {
        const values = line.split(',');
        return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    });
}

function makeScenarioCandidate(candidateId: string, scenarioId = 'semantic.article-title-text') {
    return new MutationCandidate('h1', new TextReplace('mutated'), 'http://example.test/article/demo', { tagType: 'h1' }, {
        applicationId: 'angular-realworld-example-app',
        corpusId: REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
        candidateId,
        scenarioId,
        scenarioCategory: 'content-access',
        sourceSpec: 'tests/realworld/articles.spec.ts',
        viewContext: 'article-title-text',
        eligible: true,
        aggregateComparisonEligible: true,
        relevanceBand: 'exact-touchpoint',
        relevanceScore: 600,
        familyStressHints: { semantic: true, css: false, xpath: false },
    });
}

function writeFinalizeFixture(appId: string, candidates: MutationCandidate[], successfulIds: string[]) {
    const appRoot = path.join(process.cwd(), 'test-results', appId, process.env.BENCHMARK_CORPUS_ID ?? 'realworld-active');
    fs.rmSync(appRoot, { recursive: true, force: true });
    fs.mkdirSync(appRoot, { recursive: true });

    fs.writeFileSync(path.join(appRoot, 'scenario-preflight-pool.json'), JSON.stringify({
        metadata: {
            applicationId: appId,
            generatedAt: '2026-04-21T00:00:00.000Z',
            totalCandidates: candidates.length,
            totalEligibleCandidates: candidates.length,
            budget: candidates.length,
            seed: 12345,
            categoryQuotas: {},
            selectedCounts: {},
            activeScenarioIds: Array.from(new Set(candidates.map(candidate => candidate.scenarioId).filter(Boolean))),
        },
        scenarios: candidates.map(candidate => candidate.toJSON()),
    }, null, 2));

    fs.writeFileSync(path.join(appRoot, 'scenario-preflight-results.json'), JSON.stringify({
        metadata: {
            applicationId: appId,
            generatedAt: '2026-04-21T00:00:00.000Z',
            budget: 8,
            seed: 12345,
            totalCandidates: candidates.length,
            successfulCandidates: successfulIds.length,
            successfulCountsByCategory: { structural: 0, content: successfulIds.length, 'accessibility-semantic': 0, visibility: 0 },
            successfulCountsByOperator: { TextReplace: successfulIds.length },
        },
        results: candidates.map(candidate => ({
            candidateId: candidate.candidateId,
            scenarioId: candidate.scenarioId,
            viewContext: candidate.viewContext,
            operator: candidate.operator.constructor.name,
            operatorCategory: 'content',
            selector: candidate.selector,
            success: successfulIds.includes(candidate.candidateId!),
            reason: successfulIds.includes(candidate.candidateId!) ? null : 'not-selected-for-test',
            durationMs: 1,
            touchpointLogicalKeys: candidate.touchpointLogicalKeys ?? [],
            relevanceBand: candidate.relevanceBand,
            relevanceScore: candidate.relevanceScore,
            familyStressHints: candidate.familyStressHints,
            categoryAvailabilityHint: true,
            meaningfulEffect: successfulIds.includes(candidate.candidateId!),
            meaningfulEffectReason: successfulIds.includes(candidate.candidateId!) ? null : 'not-selected-for-test',
        })),
    }, null, 2));

    return appRoot;
}

test.describe('Aggregation Script Validation', () => {
    const testDataDir = path.join(process.cwd(), 'test-results', 'agg-test');
    const outputDir = path.join(process.cwd(), 'test-results', 'agg-output');

    test.beforeAll(() => {
        if (fs.existsSync(testDataDir)) fs.rmSync(testDataDir, { recursive: true });
        if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true });
        fs.mkdirSync(testDataDir, { recursive: true });
    });

    test('should correctly aggregate mock results', async () => {
        // 1. Create Mock Data
        const mockRuns = [
            // semantic-first: 2 mutated (1 pass, 1 fail NO_MATCH), 1 baseline pass
            makeBenchmarkRun({ locatorFamily: 'semantic-first', phase: 'mutated', runStatus: 'passed', changeId: 'mut-sem-1', changeOperator: 'SubtreeDelete', changeCategory: 'structural', quotaBucket: 'structural', durationMs: 100, mutationTelemetry: { selectedCandidateId: 'mut-sem-1', selectedTargetSelector: '#target-sem-1', selectedTargetTagType: 'div', operatorRuntimeCategory: 'structural', operatorThesisCategory: 'structural', operatorConsideredCandidateCount: 5, operatorCandidateCount: 5, operatorApplicableCount: 2, operatorSkippedOracleCount: 1, operatorNotApplicableCount: 2, operatorSelectedCount: 1, operatorSelectedApplicableRatio: 0.5, operatorCheckDurationMs: 30, applyDurationMs: 10, applyFailureCount: 0, finalMutationOutcomeClass: 'applied' } }),
            makeBenchmarkRun({ locatorFamily: 'semantic-first', phase: 'mutated', runStatus: 'failed', failureClass: 'NO_MATCH', failureStage: 'ACTION', changeId: 'mut-sem-2', changeOperator: 'SubtreeDelete', changeCategory: 'structural', quotaBucket: 'structural', durationMs: 200, mutationTelemetry: { selectedCandidateId: 'mut-sem-2', selectedTargetSelector: '#target-sem-2', selectedTargetTagType: 'div', operatorRuntimeCategory: 'structural', operatorThesisCategory: 'structural', operatorConsideredCandidateCount: 5, operatorCandidateCount: 5, operatorApplicableCount: 2, operatorSkippedOracleCount: 1, operatorNotApplicableCount: 2, operatorSelectedCount: 1, operatorSelectedApplicableRatio: 0.5, operatorCheckDurationMs: 30, applyDurationMs: 12, applyFailureCount: 0, finalMutationOutcomeClass: 'applied' } }),
            makeBenchmarkRun({ locatorFamily: 'semantic-first', phase: 'baseline', runStatus: 'passed', durationMs: 50 }),
            
            // css: 2 mutated (2 fail ACTIONABILITY), 1 baseline pass
            makeBenchmarkRun({ locatorFamily: 'css', phase: 'mutated', runStatus: 'failed', failureClass: 'ACTIONABILITY', failureStage: 'ACTION', changeId: 'mut-css-1', changeOperator: 'StyleVisibility', changeCategory: 'visibility-interaction-state', quotaBucket: 'visibility', durationMs: 300, mutationTelemetry: { selectedCandidateId: 'mut-css-1', selectedTargetSelector: '#target-css-1', selectedTargetTagType: 'button', operatorRuntimeCategory: 'visibility', operatorThesisCategory: 'visibility-interaction-state', operatorConsideredCandidateCount: 4, operatorCandidateCount: 4, operatorApplicableCount: 1, operatorSkippedOracleCount: 1, operatorNotApplicableCount: 2, operatorSelectedCount: 1, operatorSelectedApplicableRatio: 1, operatorCheckDurationMs: 20, applyDurationMs: 8, applyFailureCount: 0, finalMutationOutcomeClass: 'applied' } }),
            makeBenchmarkRun({ locatorFamily: 'css', phase: 'mutated', runStatus: 'failed', failureClass: 'ACTIONABILITY', failureStage: 'ACTION', changeId: 'mut-css-2', changeOperator: 'StyleVisibility', changeCategory: 'visibility-interaction-state', quotaBucket: 'visibility', durationMs: 400, mutationTelemetry: { selectedCandidateId: 'mut-css-2', selectedTargetSelector: '#target-css-2', selectedTargetTagType: 'button', operatorRuntimeCategory: 'visibility', operatorThesisCategory: 'visibility-interaction-state', operatorConsideredCandidateCount: 4, operatorCandidateCount: 4, operatorApplicableCount: 1, operatorSkippedOracleCount: 1, operatorNotApplicableCount: 2, operatorSelectedCount: 1, operatorSelectedApplicableRatio: 1, operatorCheckDurationMs: 20, applyDurationMs: 9, applyFailureCount: 0, finalMutationOutcomeClass: 'applied' } }),
            makeBenchmarkRun({ locatorFamily: 'css', phase: 'baseline', runStatus: 'passed', durationMs: 60 }),

            // xpath: paired with css mutated runs so discordance reporting has comparable rows
            makeBenchmarkRun({ locatorFamily: 'xpath', phase: 'mutated', runStatus: 'failed', failureClass: 'NO_MATCH', failureStage: 'ACTION', changeId: 'mut-css-1', changeOperator: 'StyleVisibility', changeCategory: 'visibility-interaction-state', quotaBucket: 'visibility', durationMs: 320, mutationTelemetry: { selectedCandidateId: 'mut-css-1', selectedTargetSelector: '#target-xpath-1', selectedTargetTagType: 'button', operatorRuntimeCategory: 'visibility', operatorThesisCategory: 'visibility-interaction-state', operatorConsideredCandidateCount: 4, operatorCandidateCount: 4, operatorApplicableCount: 1, operatorSkippedOracleCount: 1, operatorNotApplicableCount: 2, operatorSelectedCount: 1, operatorSelectedApplicableRatio: 1, operatorCheckDurationMs: 21, applyDurationMs: 8, applyFailureCount: 0, finalMutationOutcomeClass: 'applied' } }),
            makeBenchmarkRun({ locatorFamily: 'xpath', phase: 'mutated', runStatus: 'failed', failureClass: 'ACTIONABILITY', failureStage: 'ACTION', changeId: 'mut-css-2', changeOperator: 'StyleVisibility', changeCategory: 'visibility-interaction-state', quotaBucket: 'visibility', durationMs: 410, mutationTelemetry: { selectedCandidateId: 'mut-css-2', selectedTargetSelector: '#target-xpath-2', selectedTargetTagType: 'button', operatorRuntimeCategory: 'visibility', operatorThesisCategory: 'visibility-interaction-state', operatorConsideredCandidateCount: 4, operatorCandidateCount: 4, operatorApplicableCount: 1, operatorSkippedOracleCount: 1, operatorNotApplicableCount: 2, operatorSelectedCount: 1, operatorSelectedApplicableRatio: 1, operatorCheckDurationMs: 21, applyDurationMs: 9, applyFailureCount: 0, finalMutationOutcomeClass: 'applied' } }),

            // Invalid run (should be ignored)
            makeBenchmarkRun({ locatorFamily: 'xpath', phase: 'mutated', runStatus: 'invalid', comparisonEligible: false, invalidRunReason: 'Setup failure', changeId: 'mut-invalid-1', changeOperator: 'StyleVisibility', changeCategory: 'visibility-interaction-state', quotaBucket: 'visibility' })
        ];

        mockRuns.forEach((run, i) => {
            fs.writeFileSync(path.join(testDataDir, `run_${i}.json`), JSON.stringify(run));
        });

        // 2. Run Aggregation
        const { execSync } = require('child_process');
        execSync(`npx ts-node src/benchmark/runner/aggregate.ts ${testDataDir} ${outputDir}`);

        // 3. Verify Outputs
        expect(fs.existsSync(path.join(outputDir, 'benchmark_runs.csv'))).toBe(true);
        expect(fs.existsSync(path.join(outputDir, 'summary_by_family.csv'))).toBe(true);
        expect(fs.existsSync(path.join(outputDir, 'aggregate_report.json'))).toBe(true);
        expect(fs.existsSync(path.join(outputDir, 'mutation_run_telemetry.csv'))).toBe(true);
        expect(fs.existsSync(path.join(outputDir, 'operator_diversity_summary.csv'))).toBe(true);
        expect(fs.existsSync(path.join(outputDir, 'css_xpath_discordance.csv'))).toBe(true);
        expect(fs.existsSync(path.join(outputDir, 'css_xpath_discordance_summary.csv'))).toBe(true);

        const summaryByFamily = fs.readFileSync(path.join(outputDir, 'summary_by_family.csv'), 'utf8');
        console.log('Summary by Family:\n', summaryByFamily);

        expect(summaryByFamily).toContain('semantic-first,3,2');
        expect(summaryByFamily).toContain('css,3,2');
        expect(summaryByFamily).toContain('0.5000');
        expect(summaryByFamily).toContain('1.0000');

        const failureDist = fs.readFileSync(path.join(outputDir, 'failure_distribution.csv'), 'utf8');
        // semantic-first: 1 fail (NO_MATCH) -> 1.0000 proportion
        expect(failureDist).toContain('semantic-first,NO_MATCH,1,1.0000');
        // css: 2 fail (ACTIONABILITY) -> 1.0000 proportion
        expect(failureDist).toContain('css,ACTIONABILITY,2,1.0000');

        const accessibilitySummary = fs.readFileSync(path.join(outputDir, 'accessibility_summary_all_valid_runs.csv'), 'utf8');
        expect(accessibilitySummary).toContain('semantic-first');
        expect(accessibilitySummary).toContain('css');

        const operatorTelemetry = fs.readFileSync(path.join(outputDir, 'operator_telemetry_summary.csv'), 'utf8');
        expect(operatorTelemetry).toContain('SubtreeDelete');
        expect(operatorTelemetry).toContain('StyleVisibility');

        const mutationRunTelemetry = fs.readFileSync(path.join(outputDir, 'mutation_run_telemetry.csv'), 'utf8');
        expect(mutationRunTelemetry).toContain('selectedTargetSelector');
        expect(mutationRunTelemetry).toContain('operatorRuntimeCategory');
        expect(mutationRunTelemetry).toContain('operatorSelectedApplicableRatio');

        const operatorDiversity = fs.readFileSync(path.join(outputDir, 'operator_diversity_summary.csv'), 'utf8');
        expect(operatorDiversity).toContain('selectedApplicableRatio');
        expect(operatorDiversity).toContain('discordanceRate');

        const cssXpathDiscordance = fs.readFileSync(path.join(outputDir, 'css_xpath_discordance_summary.csv'), 'utf8');
        expect(cssXpathDiscordance).toContain('overall,2,1,0.5000');
    });

    test('should keep only the latest record for the same logical run identity', async () => {
        const dedupeInputDir = path.join(process.cwd(), 'test-results', 'agg-dedupe-test');
        const dedupeOutputDir = path.join(process.cwd(), 'test-results', 'agg-dedupe-output');
        if (fs.existsSync(dedupeInputDir)) fs.rmSync(dedupeInputDir, { recursive: true });
        if (fs.existsSync(dedupeOutputDir)) fs.rmSync(dedupeOutputDir, { recursive: true });
        fs.mkdirSync(dedupeInputDir, { recursive: true });

        const duplicateRuns = [
            makeBenchmarkRun({ activeScenarioId: 'article.assert-title', scenarioId: 'article.assert-title [semantic-first]', activeScenarioCategory: 'content-access', sourceSpec: 'tests/realworld/article.spec.ts', locatorFamily: 'semantic-first', phase: 'mutated', runStatus: 'passed', changeId: 'candidate-1', changeOperator: 'TextInsert', changeCategory: 'content', quotaBucket: 'content', durationMs: 100 }),
            makeBenchmarkRun({ activeScenarioId: 'article.assert-title', scenarioId: 'article.assert-title [semantic-first]', activeScenarioCategory: 'content-access', sourceSpec: 'tests/realworld/article.spec.ts', locatorFamily: 'semantic-first', phase: 'mutated', runStatus: 'failed', failureClass: 'ASSERTION', failureStage: 'ASSERTION', changeId: 'candidate-1', changeOperator: 'TextInsert', changeCategory: 'content', quotaBucket: 'content', durationMs: 250 }),
        ];

        duplicateRuns.forEach((run, index) => {
            fs.writeFileSync(path.join(dedupeInputDir, `duplicate_${index}.json`), JSON.stringify(run));
        });

        const { execSync } = require('child_process');
        execSync(`npx ts-node src/benchmark/runner/aggregate.ts ${dedupeInputDir} ${dedupeOutputDir}`);

        const benchmarkRuns = fs.readFileSync(path.join(dedupeOutputDir, 'benchmark_runs.csv'), 'utf8');
        expect(benchmarkRuns).toContain('ASSERTION');
        expect(benchmarkRuns).not.toContain(',passed,');

        const summaryByFamily = fs.readFileSync(path.join(dedupeOutputDir, 'summary_by_family.csv'), 'utf8');
        expect(summaryByFamily).toContain('semantic-first,1,1,1,1');
    });

    test('semantic supplement query reports use only supplement semantic-first rows', async () => {
        const supplementInputDir = path.join(process.cwd(), 'test-results', 'agg-semantic-supplement-test');
        const supplementOutputDir = path.join(process.cwd(), 'test-results', 'agg-semantic-supplement-output');
        if (fs.existsSync(supplementInputDir)) fs.rmSync(supplementInputDir, { recursive: true });
        if (fs.existsSync(supplementOutputDir)) fs.rmSync(supplementOutputDir, { recursive: true });
        fs.mkdirSync(supplementInputDir, { recursive: true });

        const supplementBase = {
            corpusId: 'realworld-semantic-supplement',
            corpusRole: 'supplementary',
            activeScenarioId: 'semantic.article-title-text',
            scenarioId: 'semantic.article-title-text [semantic-first]',
            activeScenarioCategory: 'content-access',
            sourceSpec: 'tests/realworld/articles.spec.ts',
            intendedSemanticEntryPoint: 'getByText',
            actualSemanticEntryPoint: 'getByText',
            targetLogicalKeys: ['article.titleText'],
            semanticScenarioSupportedApps: ['angular-realworld-example-app', 'realworld', 'vue3-realworld-example-app'],
        };
        const mockRuns = [
            makeBenchmarkRun({ ...supplementBase, locatorFamily: 'semantic-first', phase: 'baseline', runStatus: 'passed' }),
            makeBenchmarkRun({ ...supplementBase, locatorFamily: 'semantic-first', phase: 'mutated', runStatus: 'failed', failureClass: 'NO_MATCH', failureStage: 'ACTION', changeId: 'sem-mut-1', changeOperator: 'TextReplace', changeCategory: 'content', quotaBucket: 'content', mutationTelemetry: { selectedCandidateId: 'sem-mut-1' } }),
            makeBenchmarkRun({ ...supplementBase, locatorFamily: 'css', phase: 'baseline', runStatus: 'passed', actualSemanticEntryPoint: null }),
            makeBenchmarkRun({ ...supplementBase, locatorFamily: 'xpath', phase: 'mutated', runStatus: 'failed', failureClass: 'NO_MATCH', failureStage: 'ACTION', actualSemanticEntryPoint: null, changeId: 'xpath-mut-1', changeOperator: 'TextReplace', changeCategory: 'content', quotaBucket: 'content', mutationTelemetry: { selectedCandidateId: 'xpath-mut-1' } }),
            makeBenchmarkRun({ corpusId: 'realworld-active', activeScenarioId: 'article.assert-title', intendedSemanticEntryPoint: 'getByAltText', actualSemanticEntryPoint: 'getByAltText', locatorFamily: 'semantic-first', phase: 'baseline', runStatus: 'passed' }),
        ];

        mockRuns.forEach((run, index) => {
            fs.writeFileSync(path.join(supplementInputDir, `semantic_${index}.json`), JSON.stringify(run));
        });

        const { execSync } = require('child_process');
        execSync(`npx ts-node src/benchmark/runner/aggregate.ts ${supplementInputDir} ${supplementOutputDir}`);

        const report = JSON.parse(fs.readFileSync(path.join(supplementOutputDir, 'aggregate_report.json'), 'utf8'));
        const getByTextSummary = report.semanticSupplement.summaryBySemanticQuery.find((row: any) => row.semanticEntryPoint === 'getByText');
        const getByAltTextSummary = report.semanticSupplement.summaryBySemanticQuery.find((row: any) => row.semanticEntryPoint === 'getByAltText');

        expect(getByTextSummary.baselineRuns).toBe(1);
        expect(getByTextSummary.mutatedRuns).toBe(1);
        expect(getByTextSummary.failures).toBe(1);
        expect(getByAltTextSummary.baselineRuns).toBe(0);
        expect(report.semanticSupplement.validation.nonSemanticSupplementRowsExcluded).toBe(2);
        expect(report.semanticSupplement.validation.nonSupplementRowsExcluded).toBe(1);

        const mapping = fs.readFileSync(path.join(supplementOutputDir, 'semantic_scenario_query_mapping.csv'), 'utf8');
        expect(mapping).toContain('semantic.article-title-text,getByText');
    });

    test('strict combined supplement aggregate writes the canonical thesis-facing artifact only', async () => {
        const resultsRoot = path.join(process.cwd(), 'test-results', 'strict-combined-complete');
        if (fs.existsSync(resultsRoot)) fs.rmSync(resultsRoot, { recursive: true });
        writeCompleteSupplementFixture(resultsRoot);

        const outputDir = generateSemanticSupplementAggregate({ resultsRoot });
        const report = JSON.parse(fs.readFileSync(path.join(outputDir, 'aggregate_report.json'), 'utf8'));

        expect(outputDir).toBe(path.join(resultsRoot, REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID, 'thesis-facing-aggregate'));
        expect(report.corpusId).toBe(REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID);
        expect(report.reportRole).toBe('canonical-thesis-facing-semantic-supplement');
        expect(report.semanticSupplement.appsIncluded.sort()).toEqual(getExpectedSupplementApps());
        expect(report.semanticSupplement.scenarioToQueryMapping).toHaveLength(
            REALWORLD_SEMANTIC_SUPPLEMENT_MANIFEST.scenarios.length * getExpectedSupplementApps().length,
        );
        expect(new Set(report.semanticSupplement.scenarioToQueryMapping.map((row: any) => row.baselineSupportStatus))).toEqual(
            new Set(['baseline-supported', 'unsupported']),
        );
        const mutationCoverageStatuses = new Set(report.semanticSupplement.scenarioToQueryMapping.map((row: any) => row.mutationCoverageStatus));
        expect(mutationCoverageStatuses.has('mutated-covered')).toBe(true);
        expect(mutationCoverageStatuses.has('unsupported')).toBe(true);
        expect(Array.from(mutationCoverageStatuses).every(status => [
            'mutated-covered',
            'no-valid-mutated-candidate',
            'mutated-coverage-missing',
            'unsupported',
        ].includes(status as string))).toBe(true);
        expect(report.semanticSupplement.validation.nonSupplementRowsExcluded).toBe(0);
        expect(report.semanticSupplement.validation.nonSemanticSupplementRowsExcluded).toBeGreaterThan(0);
        expect(report.semanticSupplement.transparency.baselineOnlySupportIsNotMutationEvidence).toBe(true);
        expect(report.semanticSupplement.transparency.notASecondPrimaryBenchmark).toBe(true);
        expect(fs.existsSync(path.join(outputDir, 'CANONICAL_THESIS_SUPPLEMENT_AGGREGATE.md'))).toBe(true);
        expect(fs.existsSync(path.join(outputDir, 'benchmark_runs.csv'))).toBe(false);
        expect(fs.existsSync(path.join(outputDir, 'summary_by_family.csv'))).toBe(false);
        expect(fs.existsSync(path.join(outputDir, 'css_xpath_discordance.csv'))).toBe(false);
        expect(fs.existsSync(path.join(resultsRoot, REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID, 'combined-aggregate'))).toBe(false);

        const summaryBySemanticQuery = fs.readFileSync(path.join(outputDir, 'summary_by_semantic_query.csv'), 'utf8');
        expect(summaryBySemanticQuery).toContain('getByLabel');
        expect(summaryBySemanticQuery).toContain('getByAltText');

        const canonicalSummaryPath = path.join(outputDir, 'semantic_supplement_summary.csv');
        expect(fs.existsSync(canonicalSummaryPath)).toBe(true);
        expect(fs.existsSync(path.join(outputDir, 'semantic_supplement_by_category.csv'))).toBe(true);
        expect(fs.existsSync(path.join(outputDir, 'semantic_supplement_by_operator.csv'))).toBe(true);
        expect(fs.existsSync(path.join(outputDir, 'semantic_supplement_validation_warnings.csv'))).toBe(true);
        expect(fs.existsSync(path.join(outputDir, 'semantic_supplement_summary.json'))).toBe(true);

        const canonicalSummary = readCsvRows(canonicalSummaryPath);
        const getByText = canonicalSummary.find(row => row.semantic_query === 'getByText');
        const getByPlaceholder = canonicalSummary.find(row => row.semantic_query === 'getByPlaceholder');
        const getByAltText = canonicalSummary.find(row => row.semantic_query === 'getByAltText');
        expect(getByText).toEqual(expect.objectContaining({
            family: 'semantic-first',
            baseline_runs: '3',
            eligible_mutated_runs: '3',
            total_failures: '0',
            failure_rate: '0.0000',
        }));
        expect(getByPlaceholder).toEqual(expect.objectContaining({
            baseline_runs: '3',
            eligible_mutated_runs: '3',
        }));
        expect(getByAltText).toEqual(expect.objectContaining({
            baseline_runs: '2',
            eligible_mutated_runs: '2',
            unsupported_count: '1',
        }));

        const canonicalJson = JSON.parse(fs.readFileSync(path.join(outputDir, 'semantic_supplement_summary.json'), 'utf8'));
        expect(canonicalJson.appsIncluded.sort()).toEqual(getExpectedSupplementApps());
        expect(canonicalJson.totals.eligibleMutatedRuns).toBe(9);
        expect(canonicalJson.queries.getByText.eligibleMutatedRuns).toBe(3);
    });

    test('canonical supplement files are semantic-first only and warn when raw CSS or XPath rows are excluded', async () => {
        const resultsRoot = path.join(process.cwd(), 'test-results', 'strict-combined-semantic-only');
        if (fs.existsSync(resultsRoot)) fs.rmSync(resultsRoot, { recursive: true });
        writeCompleteSupplementFixture(resultsRoot);

        const outputDir = generateSemanticSupplementAggregate({ resultsRoot });
        const summary = fs.readFileSync(path.join(outputDir, 'semantic_supplement_summary.csv'), 'utf8');
        const byCategory = fs.readFileSync(path.join(outputDir, 'semantic_supplement_by_category.csv'), 'utf8');
        const warnings = fs.readFileSync(path.join(outputDir, 'semantic_supplement_validation_warnings.csv'), 'utf8');

        expect(summary).toContain('semantic-first');
        expect(summary).not.toContain(',css,');
        expect(summary).not.toContain(',xpath,');
        expect(byCategory).not.toContain('css');
        expect(byCategory).not.toContain('xpath');
        expect(warnings).toContain('non-semantic-family-rows-excluded');
    });

    test('canonical supplement keeps baseline-only support separate from mutated pass evidence', async () => {
        const resultsRoot = path.join(process.cwd(), 'test-results', 'strict-combined-baseline-only');
        if (fs.existsSync(resultsRoot)) fs.rmSync(resultsRoot, { recursive: true });
        writeCompleteSupplementFixture(resultsRoot, {
            noValidCoverage: {
                'vue3-realworld-example-app': ['semantic.auth-email-label'],
            },
        });

        const outputDir = generateSemanticSupplementAggregate({ resultsRoot });
        const summary = readCsvRows(path.join(outputDir, 'semantic_supplement_summary.csv'));
        const getByLabel = summary.find(row => row.semantic_query === 'getByLabel');
        const warnings = fs.readFileSync(path.join(outputDir, 'semantic_supplement_validation_warnings.csv'), 'utf8');

        expect(getByLabel).toEqual(expect.objectContaining({
            baseline_runs: '1',
            eligible_mutated_runs: '0',
            total_failures: '0',
            failure_rate: '',
            no_valid_candidate_count: '1',
        }));
        expect(warnings).toContain('baseline-support-without-mutated-evidence');
    });

    test('canonical supplement excludes mutation-not-applied rows from eligible mutated denominators', async () => {
        const resultsRoot = path.join(process.cwd(), 'test-results', 'strict-combined-mutation-not-applied');
        if (fs.existsSync(resultsRoot)) fs.rmSync(resultsRoot, { recursive: true });
        writeCompleteSupplementFixture(resultsRoot, {
            invalidMutationCoverage: {
                'vue3-realworld-example-app': ['semantic.auth-email-label'],
            },
        });

        const outputDir = generateSemanticSupplementAggregate({ resultsRoot });
        const summary = readCsvRows(path.join(outputDir, 'semantic_supplement_summary.csv'));
        const getByLabel = summary.find(row => row.semantic_query === 'getByLabel');
        const warnings = fs.readFileSync(path.join(outputDir, 'semantic_supplement_validation_warnings.csv'), 'utf8');

        expect(getByLabel).toEqual(expect.objectContaining({
            baseline_runs: '1',
            eligible_mutated_runs: '0',
            total_failures: '0',
            failure_rate: '',
        }));
        expect(warnings).toContain('mutation-not-applied-excluded');
    });

    test('strict combined supplement aggregate demotes stale legacy combined output', async () => {
        const resultsRoot = path.join(process.cwd(), 'test-results', 'strict-combined-demotes-legacy');
        if (fs.existsSync(resultsRoot)) fs.rmSync(resultsRoot, { recursive: true });
        writeCompleteSupplementFixture(resultsRoot);
        const legacyDir = path.join(resultsRoot, REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID, 'combined-aggregate');
        fs.mkdirSync(legacyDir, { recursive: true });
        fs.writeFileSync(path.join(legacyDir, 'aggregate_report.json'), '{}');

        generateSemanticSupplementAggregate({ resultsRoot });

        expect(fs.existsSync(legacyDir)).toBe(false);
        expect(fs.existsSync(path.join(
            resultsRoot,
            REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
            'debug',
            'deprecated-combined-aggregate',
            'NONCANONICAL_DEPRECATED_SUPPLEMENT_AGGREGATE.md',
        ))).toBe(true);
    });

    test('supplement app aggregate default path is debug-only while main stays unchanged', async () => {
        const appResultsDir = path.join(process.cwd(), 'test-results', 'aggregate-default-path-check');

        expect(getDefaultAggregateOutputDir(appResultsDir, REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID)).toBe(
            path.join(appResultsDir, 'debug', 'app-aggregate'),
        );
        expect(getDefaultAggregateOutputDir(appResultsDir, 'realworld-active')).toBe(
            path.join(appResultsDir, 'aggregate'),
        );
    });

    test('supplement app aggregate demotes stale default aggregate output', async () => {
        const appResultsDir = path.join(process.cwd(), 'test-results', 'aggregate-default-demotion-check');
        if (fs.existsSync(appResultsDir)) fs.rmSync(appResultsDir, { recursive: true });
        const legacyDir = path.join(appResultsDir, 'aggregate');
        fs.mkdirSync(legacyDir, { recursive: true });
        fs.writeFileSync(path.join(legacyDir, 'aggregate_report.json'), '{}');

        demoteLegacySupplementAppAggregate(appResultsDir, path.join(appResultsDir, 'debug', 'app-aggregate'));

        expect(fs.existsSync(legacyDir)).toBe(false);
        expect(fs.existsSync(path.join(
            appResultsDir,
            'debug',
            'deprecated-app-aggregate',
            'NONCANONICAL_DEPRECATED_SUPPLEMENT_APP_AGGREGATE.md',
        ))).toBe(true);
    });

    test('strict combined supplement aggregate fails when an expected supplement app is missing', async () => {
        const resultsRoot = path.join(process.cwd(), 'test-results', 'strict-combined-missing-app');
        if (fs.existsSync(resultsRoot)) fs.rmSync(resultsRoot, { recursive: true });
        writeCompleteSupplementFixture(resultsRoot, { omitApps: [getExpectedSupplementApps()[0]] });

        expect(() => generateSemanticSupplementAggregate({
            resultsRoot,
            outputDir: path.join(resultsRoot, REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID, 'thesis-facing-aggregate'),
        })).toThrow(/missing supplement benchmark runs/);
    });

    test('strict combined supplement aggregate rejects mixed-corpus pollution', async () => {
        const resultsRoot = path.join(process.cwd(), 'test-results', 'strict-combined-mixed-corpus');
        if (fs.existsSync(resultsRoot)) fs.rmSync(resultsRoot, { recursive: true });
        writeCompleteSupplementFixture(resultsRoot, { corruptFirstRunCorpus: true });

        expect(() => generateSemanticSupplementAggregate({
            resultsRoot,
            outputDir: path.join(resultsRoot, REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID, 'thesis-facing-aggregate'),
        })).toThrow(/non-supplement corpus realworld-active/);
    });

    test('main aggregate reports do not expose supplement sections', async () => {
        const inputDir = path.join(process.cwd(), 'test-results', 'agg-main-no-supplement-test');
        const mainOutputDir = path.join(process.cwd(), 'test-results', 'agg-main-no-supplement-output');
        if (fs.existsSync(inputDir)) fs.rmSync(inputDir, { recursive: true });
        if (fs.existsSync(mainOutputDir)) fs.rmSync(mainOutputDir, { recursive: true });
        fs.mkdirSync(inputDir, { recursive: true });
        fs.writeFileSync(path.join(inputDir, 'main.json'), JSON.stringify(makeBenchmarkRun()));

        const { execSync } = require('child_process');
        execSync(`npx ts-node src/benchmark/runner/aggregate.ts ${inputDir} ${mainOutputDir}`);

        const report = JSON.parse(fs.readFileSync(path.join(mainOutputDir, 'aggregate_report.json'), 'utf8'));
        expect(report.corpusId).toBe('realworld-active');
        expect(Object.prototype.hasOwnProperty.call(report, 'semanticSupplement')).toBe(false);
        expect(fs.existsSync(path.join(mainOutputDir, 'semantic_supplement_summary.csv'))).toBe(false);
        expect(fs.existsSync(path.join(mainOutputDir, 'semantic_supplement_summary.json'))).toBe(false);
        expect(fs.readFileSync(path.join(mainOutputDir, 'summary_by_family.csv'), 'utf8')).toContain(
            'semantic-first,1,0,0,0,0,0.0000,0.0000,1.0000,0.00,0.00',
        );
    });

    test('semantic supplement finalize allows under-budget candidate yield while primary remains strict', async () => {
        const appId = 'angular-realworld-example-app';
        const originalCorpus = process.env.BENCHMARK_CORPUS_ID;
        const originalAppId = process.env.APP_ID;
        const candidates = [makeScenarioCandidate('candidate-1'), makeScenarioCandidate('candidate-2')];
        const { execSync } = require('child_process');

        try {
            process.env.APP_ID = appId;
            process.env.BENCHMARK_CORPUS_ID = 'realworld-active';
            writeFinalizeFixture(appId, candidates, ['candidate-1', 'candidate-2']);
            expect(() => execSync(
                `npx ts-node src/benchmark/runner/finalize-scenarios.ts ${appId} 8 12345`,
                { cwd: process.cwd(), env: { ...process.env, APP_ID: appId, BENCHMARK_CORPUS_ID: 'realworld-active' } },
            )).toThrow(/Only 2 validated mutation candidates are available/);

            process.env.BENCHMARK_CORPUS_ID = REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID;
            const appRoot = writeFinalizeFixture(appId, candidates, ['candidate-1', 'candidate-2']);
            execSync(
                `npx ts-node src/benchmark/runner/finalize-scenarios.ts ${appId} 8 12345`,
                { cwd: process.cwd(), env: { ...process.env, APP_ID: appId, BENCHMARK_CORPUS_ID: REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID } },
            );
            const scenarios = JSON.parse(fs.readFileSync(path.join(appRoot, 'scenarios.json'), 'utf8'));
            expect(scenarios.metadata.budget).toBe(8);
            expect(scenarios.scenarios).toHaveLength(2);
        } finally {
            if (originalCorpus === undefined) {
                delete process.env.BENCHMARK_CORPUS_ID;
            } else {
                process.env.BENCHMARK_CORPUS_ID = originalCorpus;
            }
            if (originalAppId === undefined) {
                delete process.env.APP_ID;
            } else {
                process.env.APP_ID = originalAppId;
            }
        }
    });

    test('should fail loudly on empty input', async () => {
        const emptyDir = path.join(process.cwd(), 'test-results', 'empty-test');
        if (!fs.existsSync(emptyDir)) fs.mkdirSync(emptyDir, { recursive: true });
        
        const { execSync } = require('child_process');
        try {
            execSync(`npx ts-node src/benchmark/runner/aggregate.ts ${emptyDir} ${outputDir}`);
            throw new Error('Should have failed');
        } catch (e) {
            expect(e instanceof Error ? e.message : String(e)).toContain('No valid results found to aggregate');
        }
    });
});
