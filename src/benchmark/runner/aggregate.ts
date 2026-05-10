import * as fs from 'fs';
import * as path from 'path';
import { getAppResultsDir, getSelectedAppId } from '../../apps';
import { getOperatorCatalog } from '../../webmutator/operators/catalog';
import { createRunMetadata, writeCsvRows } from '../../benchmark/result-contract';
import { getBenchmarkRetention, pruneCompactBenchmarkArtifacts } from '../../benchmark/retention';
import { validateBenchmarkPayload } from '../../benchmark/result-schema-validator';
import { CATEGORY_ORDER } from './sampling';
import {
    REALWORLD_SEMANTIC_SUPPLEMENT_MANIFEST,
    REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
    getSemanticSupplementExcludedPairs,
} from '../../benchmark/realworld-corpus';

interface AggregatedRun {
    runId: string;
    applicationId: string;
    browserName: string;
    corpusId: string;
    scenarioId: string;
    activeScenarioId: string;
    activeScenarioCategory: string;
    sourceSpec: string;
    corpusRole: string;
    intendedSemanticEntryPoint: string;
    actualSemanticEntryPoint: string;
    targetLogicalKeys: string[];
    semanticScenarioSupportedApps: string[];
    semanticScenarioExclusionReason: string;
    locatorFamily: string;
    semanticEntryPoint: string;
    phase: 'baseline' | 'mutated';
    runStatus: 'passed' | 'failed' | 'invalid';
    failureClass: string;
    changeId: string;
    changeCategory: string;
    changeOperator: string;
    quotaBucket: string;
    comparisonEligible: boolean;
    comparisonExclusionReason: string;
    durationMs: number;
    accessibilityScanStatus: 'completed' | 'failed' | 'skipped';
    totalViolations: number;
    criticalViolations: number;
    impactedNodes: number;
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
    recordedAtMs?: number;
}

interface UnsupportedRow {
    app: string;
    logicalKey: string;
    family: string;
    supported: boolean;
    reason: string | null;
    excludedFromAggregateComparison: boolean;
    aggregateComparisonEligible: boolean;
    activeInCorpus?: boolean;
    activeScenarioIds?: string[];
    specHints: string[];
}

interface ScenarioFilePayload {
    metadata?: {
        selectedCounts?: Record<string, number>;
        validatedCountsByCategory?: Record<string, number>;
        validatedCountsByOperator?: Record<string, number>;
        availableCountsByOperator?: Record<string, number>;
        selectedCountsByOperator?: Record<string, number>;
        selectedApplicableRatiosByOperator?: Record<string, number>;
        applicableButUnselectedOperators?: Record<string, string[]>;
        heavilyBlockedByOracleOperators?: string[];
        mandatoryCoverageSatisfied?: boolean;
        semanticScenarioCoverage?: Array<{
            scenarioId: string;
            status: string;
            selectedCandidateId: string | null;
            reason: string | null;
        }>;
        semanticScenarioCoverageSatisfied?: boolean;
        budget?: number;
        seed?: number;
    };
    scenarios?: Array<{
        candidateId?: string;
        operator?: {
            type?: string;
            category?: string;
        };
        quotaBucket?: string;
        operatorRuntimeCategory?: string | null;
        touchpointLogicalKeys?: string[];
        relevanceBand?: string;
        relevanceScore?: number;
        selectedForCategoryMinimum?: boolean;
    }>;
}

interface ReachableTargetsPayload {
    metadata?: {
        operatorCoverage?: Array<{
            operator: string;
            candidateCount: number;
            applicableCount: number;
            skippedOracleCount: number;
            notApplicableCount: number;
            totalCheckDurationMs: number;
        }>;
    };
}

interface PreflightPayload {
    metadata?: {
        successfulCountsByCategory?: Record<string, number>;
        successfulCountsByOperator?: Record<string, number>;
    };
    results?: Array<{
        candidateId?: string;
        operator?: string;
        operatorCategory?: string;
        success?: boolean;
        touchpointLogicalKeys?: string[];
        relevanceBand?: string;
        meaningfulEffect?: boolean;
    }>;
}

interface AggregateOptions {
    supplementResultsRoot?: string;
    supplementExpectedApps?: string[];
    thesisFacingSemanticSupplement?: boolean;
    supplementDiagnosticRowCounts?: {
        nonSemanticSupplementRowsExcluded: number;
        nonSupplementRowsExcluded: number;
    };
}

const CATEGORY_MAPPING: Record<string, string> = Object.fromEntries(
    getOperatorCatalog().map(entry => [entry.type, entry.runtimeCategory]),
);

function getCategory(operator: string, existingCategory?: string): string {
    if (existingCategory) return existingCategory;
    return CATEGORY_MAPPING[operator] || 'unknown';
}

function getAllFiles(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllFiles(file));
        } else {
            results.push(file);
        }
    });
    return results;
}

function buildRunIdentity(run: AggregatedRun): string {
    const mutationIdentity =
        run.phase === 'mutated'
            ? run.changeId && run.changeId !== 'none'
                ? run.changeId
                : run.runId
            : 'baseline';

    return [
        run.applicationId,
        run.browserName,
        run.corpusId,
        run.activeScenarioId,
        run.locatorFamily,
        run.phase,
        mutationIdentity,
    ].join('|');
}

function dedupeRuns(runs: AggregatedRun[]): AggregatedRun[] {
    const latestByIdentity = new Map<string, AggregatedRun>();

    for (const run of runs) {
        const identity = buildRunIdentity(run);
        const existing = latestByIdentity.get(identity);
        if (!existing || (run.recordedAtMs ?? 0) >= (existing.recordedAtMs ?? 0)) {
            latestByIdentity.set(identity, run);
        }
    }

    return [...latestByIdentity.values()].sort((left, right) => (left.recordedAtMs ?? 0) - (right.recordedAtMs ?? 0));
}

export function loadResults(inputDir: string): AggregatedRun[] {
    const runs: AggregatedRun[] = [];
    const files = getAllFiles(inputDir).filter(f => f.endsWith('.json') && !f.includes('axe.json'));

    for (const file of files) {
        try {
            const stat = fs.statSync(file);
            const content = JSON.parse(fs.readFileSync(file, 'utf8'));
            const validation = validateBenchmarkPayload(content, file);
            if (!validation.valid) {
                const details = validation.errors
                    .map(error => `${error.jsonPath}: ${error.message}`)
                    .join('; ');
                throw new Error(`Invalid benchmark result structure in ${file}: ${details}`);
            }
            if (!content.runId || !content.locatorFamily || !content.phase) {
                console.warn(`Skipping malformed record: ${file}`);
                continue;
            }
            if (!content.corpusId || !content.activeScenarioId) {
                console.warn(`Skipping legacy non-corpus benchmark record: ${file}`);
                continue;
            }
            if (
                typeof content.scenarioId === 'string' &&
                (content.scenarioId.includes(' Collection @app:') || content.scenarioId.includes('collect reachable targets:'))
            ) {
                continue;
            }

            runs.push({
                runId: content.runId,
                applicationId: content.applicationId || 'unknown',
                browserName: content.browserName || 'unknown',
                corpusId: content.corpusId,
                scenarioId: content.scenarioId || 'unknown',
                activeScenarioId: content.activeScenarioId,
                activeScenarioCategory: content.activeScenarioCategory || 'unknown',
                sourceSpec: content.sourceSpec || 'unknown',
                corpusRole: content.corpusRole || 'primary',
                intendedSemanticEntryPoint: content.intendedSemanticEntryPoint || 'none',
                actualSemanticEntryPoint: content.actualSemanticEntryPoint || content.semanticEntryPoint || 'none',
                targetLogicalKeys: content.targetLogicalKeys || [],
                semanticScenarioSupportedApps: content.semanticScenarioSupportedApps || [],
                semanticScenarioExclusionReason: content.semanticScenarioExclusionReason || 'none',
                locatorFamily: content.locatorFamily,
                semanticEntryPoint: content.semanticEntryPoint || 'none',
                phase: content.phase,
                runStatus: content.runStatus,
                failureClass: content.failureClass || 'none',
                changeId: content.changeId || 'none',
                changeOperator: content.changeOperator || 'none',
                changeCategory: getCategory(content.changeOperator, content.changeCategory),
                quotaBucket: content.quotaBucket || getCategory(content.changeOperator, content.changeCategory),
                comparisonEligible: content.comparisonEligible !== false,
                comparisonExclusionReason: content.comparisonExclusionReason || 'none',
                durationMs: content.durationMs || 0,
                accessibilityScanStatus: content.accessibility?.scanStatus || 'skipped',
                totalViolations: content.accessibility?.totalViolations || 0,
                criticalViolations: content.accessibility?.criticalCount || 0,
                impactedNodes: content.accessibility?.impactedNodeCount || 0,
                mutationTelemetry: content.mutationTelemetry || undefined,
                recordedAtMs: stat.mtimeMs,
            });
        } catch (e) {
            throw new Error(`Failed to load benchmark result ${file}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    return dedupeRuns(runs);
}

function writeCsv(filePath: string, data: any[]) {
    if (data.length === 0) return;
    writeCsvRows(filePath, data);
}

function writeCsvWithHeaders(filePath: string, headers: string[], data: any[]) {
    if (data.length === 0) {
        fs.writeFileSync(filePath, headers.join(','));
        return;
    }
    writeCsvRows(filePath, data);
}

function readJsonIfPresent<T>(filePath: string): T | null {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function mean(values: number[]): number {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function outcomeSignature(run: AggregatedRun): string {
    if (run.runStatus === 'passed') {
        return 'passed';
    }
    if (run.runStatus === 'failed') {
        return `failed:${run.failureClass || 'unknown'}`;
    }
    return `invalid:${run.comparisonExclusionReason || run.failureClass || 'unknown'}`;
}

function pairKey(run: AggregatedRun): string {
    return [
        run.applicationId,
        run.browserName,
        run.activeScenarioId,
        run.changeId,
    ].join('|');
}

function isCssOrXpathFamily(family: string): family is 'css' | 'xpath' {
    return family === 'css' || family === 'xpath';
}

export function aggregate(runs: AggregatedRun[], outputDir: string, options: AggregateOptions = {}) {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const thesisFacingSemanticSupplement = options.thesisFacingSemanticSupplement === true;
    const appRootDir = path.dirname(outputDir);
    const scenarioPayload = readJsonIfPresent<ScenarioFilePayload>(path.join(appRootDir, 'scenarios.json'));
    const preflightPayload = readJsonIfPresent<PreflightPayload>(path.join(appRootDir, 'scenario-preflight-results.json'));
    const reachableTargetsPayload = readJsonIfPresent<ReachableTargetsPayload>(path.join(appRootDir, 'reachable-targets.json'));

    if (!thesisFacingSemanticSupplement) {
        writeCsv(path.join(outputDir, 'benchmark_runs.csv'), runs);
    }

    const mutated = runs.filter(r => r.phase === 'mutated');
    const baseline = runs.filter(r => r.phase === 'baseline');
    const families = Array.from(new Set(runs.map(r => r.locatorFamily)));
    const appsInRuns = Array.from(new Set(runs.map(run => run.applicationId)));
    const corpusIds = Array.from(new Set(runs.map(run => run.corpusId)));
    const activeScenarioIds = Array.from(new Set(runs.map(run => run.activeScenarioId))).sort();

    const unsupportedPath = path.join(process.cwd(), 'reports', 'realworld-locator-unsupported.json');
    let unsupportedRows: UnsupportedRow[] = [];
    if (fs.existsSync(unsupportedPath)) {
        unsupportedRows = JSON.parse(fs.readFileSync(unsupportedPath, 'utf8')).filter((row: UnsupportedRow) => appsInRuns.includes(row.app));
    }

    if (!thesisFacingSemanticSupplement && unsupportedRows.length > 0) {
        writeCsv(path.join(outputDir, 'excluded_unsupported.csv'), unsupportedRows);
        fs.writeFileSync(path.join(outputDir, 'excluded_unsupported.json'), JSON.stringify(unsupportedRows, null, 2));
    }

    const summaryByFamily = families.map(family => {
        const familyRuns = runs.filter(r => r.locatorFamily === family);
        const familyMutated = familyRuns.filter(r => r.phase === 'mutated');
        const failedMutated = familyMutated.filter(r => r.runStatus === 'failed');
        const comparableMutated = familyMutated.filter(r => r.comparisonEligible);
        const durations = familyMutated.map(r => r.durationMs).sort((a, b) => a - b);

        return {
            family,
            totalRuns: familyRuns.length,
            mutatedRuns: familyMutated.length,
            comparableMutatedRuns: comparableMutated.length,
            failedMutatedRuns: failedMutated.length,
            failedComparableMutatedRuns: comparableMutated.filter(r => r.runStatus === 'failed').length,
            failureRateMutated: (failedMutated.length / familyMutated.length || 0).toFixed(4),
            failureRateComparableMutated: (comparableMutated.filter(r => r.runStatus === 'failed').length / comparableMutated.length || 0).toFixed(4),
            baselinePassRate: (familyRuns.filter(r => r.phase === 'baseline' && r.runStatus === 'passed').length / familyRuns.filter(r => r.phase === 'baseline').length || 0).toFixed(4),
            meanDurationMs: mean(durations).toFixed(2),
            medianDurationMs: (durations[Math.floor(durations.length / 2)] || 0).toFixed(2),
        };
    });
    if (!thesisFacingSemanticSupplement) {
        writeCsv(path.join(outputDir, 'summary_by_family.csv'), summaryByFamily);
    }

    const categories = Array.from(new Set(mutated.map(r => r.changeCategory)));
    const summaryByFamilyCategory = [];
    for (const family of families) {
        for (const category of categories) {
            const cellRuns = mutated.filter(r => r.locatorFamily === family && r.changeCategory === category);
            if (cellRuns.length === 0) continue;
            const comparable = cellRuns.filter(r => r.comparisonEligible);
            const failedComparable = comparable.filter(r => r.runStatus === 'failed');
            summaryByFamilyCategory.push({
                family,
                category,
                totalMutated: cellRuns.length,
                comparableMutated: comparable.length,
                failedComparableMutated: failedComparable.length,
                failureRateComparable: (failedComparable.length / comparable.length || 0).toFixed(4),
                meanDuration: mean(cellRuns.map(r => r.durationMs)).toFixed(2),
                meanViolationsComparable: mean(comparable.map(r => r.totalViolations)).toFixed(2),
            });
        }
    }
    if (!thesisFacingSemanticSupplement) {
        writeCsv(path.join(outputDir, 'summary_by_family_and_category.csv'), summaryByFamilyCategory);
    }

    const operators = Array.from(new Set(mutated.map(r => r.changeOperator)));
    const summaryByFamilyOperator = [];
    for (const family of families) {
        for (const operator of operators) {
            const cellRuns = mutated.filter(r => r.locatorFamily === family && r.changeOperator === operator);
            if (cellRuns.length === 0) continue;
            const comparable = cellRuns.filter(r => r.comparisonEligible);
            summaryByFamilyOperator.push({
                family,
                operator,
                totalMutated: cellRuns.length,
                comparableMutated: comparable.length,
                failedComparableMutated: comparable.filter(r => r.runStatus === 'failed').length,
                failureRateComparable: (comparable.filter(r => r.runStatus === 'failed').length / comparable.length || 0).toFixed(4),
            });
        }
    }
    if (!thesisFacingSemanticSupplement) {
        writeCsv(path.join(outputDir, 'summary_by_family_and_operator.csv'), summaryByFamilyOperator);
    }

    const failureClasses = Array.from(new Set(mutated.filter(r => r.runStatus === 'failed').map(r => r.failureClass)));
    const failureDist = [];
    for (const family of families) {
        const familyFailed = mutated.filter(r => r.locatorFamily === family && r.runStatus === 'failed');
        if (familyFailed.length === 0) continue;
        for (const failureClass of failureClasses) {
            const count = familyFailed.filter(r => r.failureClass === failureClass).length;
            failureDist.push({
                family,
                failureClass,
                count,
                proportion: (count / familyFailed.length).toFixed(4)
            });
        }
    }
    if (!thesisFacingSemanticSupplement) {
        writeCsv(path.join(outputDir, 'failure_distribution.csv'), failureDist);
    }

    const appSummary = appsInRuns.map(app => {
        const appRuns = runs.filter(run => run.applicationId === app);
        const mutatedRuns = appRuns.filter(run => run.phase === 'mutated');
        return {
            applicationId: app,
            corpusId: Array.from(new Set(appRuns.map(run => run.corpusId))).join('|'),
            totalRuns: appRuns.length,
            mutatedRuns: mutatedRuns.length,
            failedRuns: appRuns.filter(run => run.runStatus === 'failed').length,
            invalidRuns: appRuns.filter(run => run.runStatus === 'invalid').length,
            unsupportedExclusions: unsupportedRows.filter(row => row.app === app && row.activeInCorpus !== false).length,
        };
    });
    writeCsv(path.join(outputDir, 'summary_by_app.csv'), appSummary);

    const browserSummary = Array.from(new Set(runs.map(run => run.browserName))).sort().map(browserName => {
        const browserRuns = runs.filter(run => run.browserName === browserName);
        return {
            browserName,
            totalRuns: browserRuns.length,
            baselineRuns: browserRuns.filter(run => run.phase === 'baseline').length,
            mutatedRuns: browserRuns.filter(run => run.phase === 'mutated').length,
            failedRuns: browserRuns.filter(run => run.runStatus === 'failed').length,
        };
    });
    writeCsv(path.join(outputDir, 'summary_by_browser.csv'), browserSummary);

    const browserNames = Array.from(new Set(runs.map(run => run.browserName))).sort();
    const summaryByBrowserFamily = [];
    for (const browserName of browserNames) {
        for (const family of families) {
            const cellRuns = runs.filter(run => run.browserName === browserName && run.locatorFamily === family);
            if (cellRuns.length === 0) continue;
            const cellMutated = cellRuns.filter(run => run.phase === 'mutated');
            const comparableMutated = cellMutated.filter(run => run.comparisonEligible);
            summaryByBrowserFamily.push({
                browserName,
                family,
                totalRuns: cellRuns.length,
                baselineRuns: cellRuns.filter(run => run.phase === 'baseline').length,
                mutatedRuns: cellMutated.length,
                comparableMutatedRuns: comparableMutated.length,
                failedComparableMutatedRuns: comparableMutated.filter(run => run.runStatus === 'failed').length,
                failureRateComparableMutated: (comparableMutated.filter(run => run.runStatus === 'failed').length / comparableMutated.length || 0).toFixed(4),
            });
        }
    }
    if (!thesisFacingSemanticSupplement) {
        writeCsv(path.join(outputDir, 'summary_by_browser_and_family.csv'), summaryByBrowserFamily);
    }

    const summaryByBrowserFamilyCategory = [];
    for (const browserName of browserNames) {
        for (const family of families) {
            for (const category of categories) {
                const cellRuns = mutated.filter(run => run.browserName === browserName && run.locatorFamily === family && run.changeCategory === category);
                if (cellRuns.length === 0) continue;
                const comparable = cellRuns.filter(run => run.comparisonEligible);
                summaryByBrowserFamilyCategory.push({
                    browserName,
                    family,
                    category,
                    totalMutated: cellRuns.length,
                    comparableMutated: comparable.length,
                    failedComparableMutated: comparable.filter(run => run.runStatus === 'failed').length,
                    failureRateComparable: (comparable.filter(run => run.runStatus === 'failed').length / comparable.length || 0).toFixed(4),
                });
            }
        }
    }
    if (!thesisFacingSemanticSupplement) {
        writeCsv(path.join(outputDir, 'summary_by_browser_family_and_category.csv'), summaryByBrowserFamilyCategory);
    }

    const exclusionSummary = [
        ...unsupportedRows.map(row => ({
            exclusionType: 'unsupported-coverage',
            app: row.app,
            family: row.family,
            logicalKey: row.logicalKey,
            reason: row.reason,
            activeInCorpus: row.activeInCorpus ?? false,
        })),
        ...mutated
            .filter(run => !run.comparisonEligible)
            .map(run => ({
                exclusionType: 'run-level',
                app: run.applicationId,
                family: run.locatorFamily,
                logicalKey: run.changeId,
                reason: run.comparisonExclusionReason,
                activeInCorpus: true,
            })),
    ];
    if (!thesisFacingSemanticSupplement) {
        writeCsv(path.join(outputDir, 'exclusion_summary.csv'), exclusionSummary);
    }

    const comparisonDenominators = families.map(family => {
        const familyMutated = mutated.filter(run => run.locatorFamily === family);
        const comparableMutated = familyMutated.filter(run => run.comparisonEligible);
        return {
            family,
            totalMutatedRuns: familyMutated.length,
            comparableMutatedRuns: comparableMutated.length,
            excludedMutatedRuns: familyMutated.length - comparableMutated.length,
            invalidMutatedRuns: familyMutated.filter(run => run.runStatus === 'invalid').length,
        };
    });
    if (!thesisFacingSemanticSupplement) {
        writeCsv(path.join(outputDir, 'comparison_denominators.csv'), comparisonDenominators);
    }

    const isSemanticSupplement = corpusIds.includes(REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID);
    const supplementScenarioEntries = REALWORLD_SEMANTIC_SUPPLEMENT_MANIFEST.scenarios;
    const supplementScenarioIds = new Set(supplementScenarioEntries.map(entry => entry.scenarioId));
    const semanticEntryPoints = ['getByRole', 'getByLabel', 'getByText', 'getByPlaceholder', 'getByAltText', 'getByTitle', 'none'];
    const thesisFacingSemanticEntryPoints = ['getByLabel', 'getByText', 'getByPlaceholder', 'getByAltText', 'getByTitle'];
    const supplementRows = runs.filter(run =>
        run.corpusId === REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID &&
        supplementScenarioIds.has(run.activeScenarioId),
    );
    const semanticSupplementRows = supplementRows.filter(run => run.locatorFamily === 'semantic-first');
    const semanticSupplementBaseline = semanticSupplementRows.filter(run => run.phase === 'baseline');
    const semanticSupplementMutated = semanticSupplementRows.filter(run => run.phase === 'mutated');
    const semanticSupplementEligibleMutated = semanticSupplementMutated.filter(run => run.comparisonEligible);
    const queryForSemanticRun = (run: AggregatedRun) =>
        run.actualSemanticEntryPoint && run.actualSemanticEntryPoint !== 'none'
            ? run.actualSemanticEntryPoint
            : 'none';
    const scenarioPayloadsByApp = new Map<string, ScenarioFilePayload>();
    const semanticSupplementAppsForReporting = options.supplementExpectedApps ?? appsInRuns;
    const semanticSupplementResultsRoot = options.supplementResultsRoot ?? path.join(process.cwd(), 'test-results');
    for (const app of semanticSupplementAppsForReporting) {
        const conventionalScenarioPath = path.join(
            semanticSupplementResultsRoot,
            app,
            REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
            'scenarios.json',
        );
        const payload = readJsonIfPresent<ScenarioFilePayload>(conventionalScenarioPath);
        if (payload) {
            scenarioPayloadsByApp.set(app, payload);
        }
    }
    if (scenarioPayload && appsInRuns.length === 1 && !scenarioPayloadsByApp.has(appsInRuns[0])) {
        scenarioPayloadsByApp.set(appsInRuns[0], scenarioPayload);
    }
    const semanticCoverageStatusByAppScenario = new Map<string, { status: string; reason: string | null }>();
    for (const [app, payload] of scenarioPayloadsByApp.entries()) {
        for (const row of payload.metadata?.semanticScenarioCoverage ?? []) {
            semanticCoverageStatusByAppScenario.set(`${app}::${row.scenarioId}`, {
                status: row.status,
                reason: row.reason,
            });
        }
    }
    const semanticSupplementExclusions = isSemanticSupplement
        ? getSemanticSupplementExcludedPairs()
            .filter(pair => semanticSupplementAppsForReporting.includes(pair.appId))
            .map(pair => ({
                corpusId: pair.corpusId,
                scenarioId: pair.scenarioId,
                appId: pair.appId,
                intendedSemanticEntryPoint: pair.intendedSemanticEntryPoint,
                excluded: true,
                exclusionReason: pair.reason,
            }))
        : [];

    const countSemanticRows = (rows: AggregatedRun[], entryPoint: string) =>
        rows.filter(run => queryForSemanticRun(run) === entryPoint).length;
    const baselineSemanticSupportDistribution = semanticEntryPoints
        .map(entryPoint => ({
            view: 'baseline-semantic-support',
            semanticEntryPoint: entryPoint,
            runs: countSemanticRows(semanticSupplementBaseline.filter(run => run.runStatus === 'passed'), entryPoint),
            comparisonEligibleRuns: '',
            failedComparisonEligibleRuns: '',
        }))
        .filter(row => row.runs > 0 || row.semanticEntryPoint !== 'none');
    const mutatedSemanticEvidenceDistribution = semanticEntryPoints
        .map(entryPoint => ({
            view: 'mutated-semantic-evidence',
            semanticEntryPoint: entryPoint,
            runs: countSemanticRows(semanticSupplementMutated, entryPoint),
            comparisonEligibleRuns: countSemanticRows(semanticSupplementEligibleMutated, entryPoint),
            failedComparisonEligibleRuns: countSemanticRows(
                semanticSupplementEligibleMutated.filter(run => run.runStatus === 'failed'),
                entryPoint,
            ),
        }))
        .filter(row => row.runs > 0 || row.comparisonEligibleRuns > 0 || row.semanticEntryPoint !== 'none');
    const semanticQueryDistribution = [
        ...baselineSemanticSupportDistribution,
        ...mutatedSemanticEvidenceDistribution,
    ];

    const semanticScenarioQueryMapping = supplementScenarioEntries
        .flatMap(scenario => semanticSupplementAppsForReporting.map(applicationId => {
            const supported = scenario.supportedApps.includes(applicationId as any);
            const exclusion = scenario.excludedApps.find(item => item.appId === applicationId);
            const scenarioBaseline = semanticSupplementBaseline.filter(run =>
                run.applicationId === applicationId &&
                run.activeScenarioId === scenario.scenarioId,
            );
            const scenarioMutated = semanticSupplementMutated.filter(run =>
                run.applicationId === applicationId &&
                run.activeScenarioId === scenario.scenarioId,
            );
            const scenarioEligibleMutated = scenarioMutated.filter(run => run.comparisonEligible);
            const coverageMetadata = semanticCoverageStatusByAppScenario.get(`${applicationId}::${scenario.scenarioId}`);
            const baselineSupported = scenarioBaseline.some(run => run.runStatus === 'passed');
            const coverageStatus = !supported
                ? 'unsupported-in-this-app'
                : !baselineSupported
                    ? 'baseline-support-missing'
                    : scenarioEligibleMutated.length > 0
                        ? 'baseline-supported-mutated-covered'
                        : coverageMetadata?.status === 'baseline-supported-no-valid-mutated-candidate'
                            ? 'baseline-supported-no-valid-mutated-candidate'
                            : 'baseline-supported-mutated-coverage-missing';
            const exclusionReason = !supported
                ? exclusion?.reason ?? 'scenario not supported for this app'
                : coverageStatus === 'baseline-supported-no-valid-mutated-candidate'
                    ? coverageMetadata?.reason ?? 'no valid mutated candidate recorded'
                    : coverageStatus === 'baseline-supported-mutated-coverage-missing'
                        ? 'supported baseline scenario has no comparison-eligible mutated semantic-first evidence'
                        : null;
            const baselineSupportStatus = !supported
                ? 'unsupported'
                : baselineSupported
                    ? 'baseline-supported'
                    : 'baseline-support-missing';
            const mutationCoverageStatus = !supported
                ? 'unsupported'
                : scenarioEligibleMutated.length > 0
                    ? 'mutated-covered'
                    : coverageStatus === 'baseline-supported-no-valid-mutated-candidate'
                        ? 'no-valid-mutated-candidate'
                        : 'mutated-coverage-missing';

            return {
                applicationId,
                scenarioId: scenario.scenarioId,
                intendedSemanticEntryPoint: scenario.intendedSemanticEntryPoint,
                actualBaselineSemanticEntryPoints: JSON.stringify(Array.from(new Set(scenarioBaseline.map(queryForSemanticRun))).sort()),
                actualMutatedSemanticEntryPoints: JSON.stringify(Array.from(new Set(scenarioMutated.map(queryForSemanticRun))).sort()),
                supportStatus: coverageStatus,
                baselineSupportStatus,
                mutationCoverageStatus,
                baselineSemanticSupportRuns: scenarioBaseline.filter(run => run.runStatus === 'passed').length,
                mutatedSemanticRuns: scenarioMutated.length,
                comparisonEligibleMutatedSemanticRuns: scenarioEligibleMutated.length,
                targetLogicalKeys: JSON.stringify(scenario.targetLogicalKeys),
                supportedApps: JSON.stringify(scenario.supportedApps),
                excluded: !supported,
                exclusionReason,
            };
        }))
        .sort((left, right) => `${left.applicationId}:${left.scenarioId}`.localeCompare(`${right.applicationId}:${right.scenarioId}`));

    const supportedButNoValidMutationByQuery = semanticScenarioQueryMapping.reduce((acc, row) => {
        if (row.supportStatus === 'baseline-supported-no-valid-mutated-candidate') {
            acc[row.intendedSemanticEntryPoint] = (acc[row.intendedSemanticEntryPoint] ?? 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);
    const summaryBySemanticQuery = semanticEntryPoints.map(entryPoint => {
        const queryBaseline = semanticSupplementBaseline.filter(run => queryForSemanticRun(run) === entryPoint);
        const queryMutated = semanticSupplementMutated.filter(run => queryForSemanticRun(run) === entryPoint);
        const comparable = queryMutated.filter(run => run.comparisonEligible);
        const failedComparable = comparable.filter(run => run.runStatus === 'failed');
        return {
            semanticEntryPoint: entryPoint,
            baselineRuns: queryBaseline.length,
            mutatedRuns: queryMutated.length,
            eligibleMutatedRuns: comparable.length,
            failures: failedComparable.length,
            failureRate: (failedComparable.length / comparable.length || 0).toFixed(4),
            supportedButNoValidMutationCount: supportedButNoValidMutationByQuery[entryPoint] ?? 0,
        };
    }).filter(row =>
        row.baselineRuns > 0 ||
        row.mutatedRuns > 0 ||
        row.supportedButNoValidMutationCount > 0 ||
        row.semanticEntryPoint !== 'none',
    );
    const summaryBySemanticQueryCategory = [];
    for (const entryPoint of semanticEntryPoints) {
        for (const category of categories) {
            const cellRuns = semanticSupplementMutated.filter(run => queryForSemanticRun(run) === entryPoint && run.changeCategory === category);
            if (cellRuns.length === 0) continue;
            const comparable = cellRuns.filter(run => run.comparisonEligible);
            const failedComparable = comparable.filter(run => run.runStatus === 'failed');
            summaryBySemanticQueryCategory.push({
                semanticEntryPoint: entryPoint,
                category,
                totalMutated: cellRuns.length,
                comparisonEligibleRuns: comparable.length,
                failedComparisonEligibleRuns: failedComparable.length,
                failureRateComparisonEligible: (failedComparable.length / comparable.length || 0).toFixed(4),
            });
        }
    }
    const failureDistributionBySemanticQuery = [];
    for (const entryPoint of semanticEntryPoints) {
        const queryEligibleMutated = semanticSupplementEligibleMutated.filter(run => queryForSemanticRun(run) === entryPoint);
        const failedRuns = queryEligibleMutated.filter(run => run.runStatus === 'failed');
        if (queryEligibleMutated.length === 0) {
            const baselineOnlyCount = semanticSupplementBaseline.filter(run => queryForSemanticRun(run) === entryPoint).length;
            if (baselineOnlyCount > 0 || (supportedButNoValidMutationByQuery[entryPoint] ?? 0) > 0) {
                failureDistributionBySemanticQuery.push({
                    semanticEntryPoint: entryPoint,
                    failureClass: 'none',
                    count: 0,
                    proportion: '0.0000',
                    evidenceStatus: 'baseline-only-no-mutated-evidence',
                });
            }
            continue;
        }
        if (failedRuns.length === 0) {
            failureDistributionBySemanticQuery.push({
                semanticEntryPoint: entryPoint,
                failureClass: 'none',
                count: 0,
                proportion: '0.0000',
                evidenceStatus: 'mutated-evidence-no-failures',
            });
            continue;
        }
        for (const failureClass of Array.from(new Set(failedRuns.map(run => run.failureClass)))) {
            const count = failedRuns.filter(run => run.failureClass === failureClass).length;
            failureDistributionBySemanticQuery.push({
                semanticEntryPoint: entryPoint,
                failureClass,
                count,
                proportion: (count / failedRuns.length || 0).toFixed(4),
                evidenceStatus: 'mutated-evidence',
            });
        }
    }
    const semanticValidationWarnings = isSemanticSupplement
        ? [
            ...runs
                .filter(run => run.corpusId !== REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID)
                .map(run => ({
                    validationType: 'non-supplement-row-excluded',
                    applicationId: run.applicationId,
                    scenarioId: run.activeScenarioId,
                    family: run.locatorFamily,
                    message: 'Row was excluded from supplement semantic query reporting because it is not in the supplementary semantic corpus.',
                })),
            ...supplementRows
                .filter(run => run.locatorFamily !== 'semantic-first')
                .map(run => ({
                    validationType: 'non-semantic-family-excluded',
                    applicationId: run.applicationId,
                    scenarioId: run.activeScenarioId,
                    family: run.locatorFamily,
                    message: 'Non-semantic family row was excluded from supplement semantic query reporting.',
                })),
            ...semanticSupplementRows
                .filter(run => {
                    const scenario = supplementScenarioEntries.find(entry => entry.scenarioId === run.activeScenarioId);
                    return scenario && queryForSemanticRun(run) !== 'none' && queryForSemanticRun(run) !== scenario.intendedSemanticEntryPoint;
                })
                .map(run => ({
                    validationType: 'semantic-query-mismatch',
                    applicationId: run.applicationId,
                    scenarioId: run.activeScenarioId,
                    family: run.locatorFamily,
                    message: `Actual semantic entry point ${queryForSemanticRun(run)} does not match the intended supplement query ${supplementScenarioEntries.find(entry => entry.scenarioId === run.activeScenarioId)?.intendedSemanticEntryPoint}.`,
                })),
            ...(semanticSupplementEligibleMutated.length === 0
                ? [{
                    validationType: 'zero-eligible-mutated-semantic-rows',
                    applicationId: appsInRuns.join('|'),
                    scenarioId: 'all',
                    family: 'semantic-first',
                    message: 'Supplement semantic mutated query summaries were computed with zero comparison-eligible mutated semantic-first rows.',
                }]
                : []),
            ...semanticScenarioQueryMapping
                .filter(row => row.supportStatus === 'baseline-supported-mutated-coverage-missing')
                .map(row => ({
                    validationType: 'unexplained-missing-mutated-coverage',
                    applicationId: row.applicationId,
                    scenarioId: row.scenarioId,
                    family: 'semantic-first',
                    message: row.exclusionReason ?? 'Supported supplement scenario has no mutated semantic-first coverage and no no-valid-candidate explanation.',
                })),
        ]
        : [];
    const nonSemanticSupplementRowsExcluded =
        options.supplementDiagnosticRowCounts?.nonSemanticSupplementRowsExcluded ??
        (supplementRows.length - semanticSupplementRows.length);
    const nonSupplementRowsExcluded =
        options.supplementDiagnosticRowCounts?.nonSupplementRowsExcluded ??
        (runs.length - supplementRows.length);
    const uniqueScenarioMetadataValues = (key: 'seed' | 'budget') =>
        Array.from(new Set([...scenarioPayloadsByApp.values()]
            .map(payload => payload.metadata?.[key])
            .filter((value): value is number => typeof value === 'number')))
            .sort((left, right) => left - right);
    const supplementSeeds = uniqueScenarioMetadataValues('seed');
    const supplementBudgets = uniqueScenarioMetadataValues('budget');
    const supplementSeed = supplementSeeds.length === 1 ? supplementSeeds[0] : null;
    const supplementBudget = supplementBudgets.length === 1 ? supplementBudgets[0] : null;
    const formatSupplementFailureRate = (failures: number, denominator: number) =>
        denominator > 0 ? (failures / denominator).toFixed(4) : null;
    const appCountWithSupplementSupportByQuery = semanticScenarioQueryMapping.reduce((acc, row) => {
        if (row.baselineSupportStatus === 'baseline-supported') {
            const apps = acc.get(row.intendedSemanticEntryPoint) ?? new Set<string>();
            apps.add(row.applicationId);
            acc.set(row.intendedSemanticEntryPoint, apps);
        }
        return acc;
    }, new Map<string, Set<string>>());
    const unsupportedCountByQuery = semanticScenarioQueryMapping.reduce((acc, row) => {
        if (row.mutationCoverageStatus === 'unsupported') {
            acc[row.intendedSemanticEntryPoint] = (acc[row.intendedSemanticEntryPoint] ?? 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);
    const thesisFacingSupplementSummary = thesisFacingSemanticEntryPoints.map(entryPoint => {
        const queryBaseline = semanticSupplementBaseline.filter(run =>
            run.runStatus === 'passed' &&
            queryForSemanticRun(run) === entryPoint
        );
        const queryEligibleMutated = semanticSupplementEligibleMutated.filter(run => queryForSemanticRun(run) === entryPoint);
        const queryFailures = queryEligibleMutated.filter(run => run.runStatus === 'failed');

        return {
            corpus: REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
            run_mode: 'supplement',
            seed: supplementSeed,
            budget: supplementBudget,
            family: 'semantic-first',
            semantic_query: entryPoint,
            baseline_runs: queryBaseline.length,
            eligible_mutated_runs: queryEligibleMutated.length,
            total_failures: queryFailures.length,
            failure_rate: formatSupplementFailureRate(queryFailures.length, queryEligibleMutated.length),
            unsupported_count: unsupportedCountByQuery[entryPoint] ?? 0,
            no_valid_candidate_count: supportedButNoValidMutationByQuery[entryPoint] ?? 0,
        };
    });
    const thesisFacingSupplementByCategory = thesisFacingSemanticEntryPoints.flatMap(entryPoint => {
        const entryRows = semanticSupplementEligibleMutated.filter(run => queryForSemanticRun(run) === entryPoint);
        return Array.from(new Set(entryRows.map(run => run.changeCategory))).sort().map(category => {
            const categoryRows = entryRows.filter(run => run.changeCategory === category);
            const failures = categoryRows.filter(run => run.runStatus === 'failed').length;
            return {
                semantic_query: entryPoint,
                mutation_category: category,
                eligible_mutated_runs: categoryRows.length,
                total_failures: failures,
                failure_rate: formatSupplementFailureRate(failures, categoryRows.length),
            };
        });
    });
    const thesisFacingSupplementByOperator = thesisFacingSemanticEntryPoints.flatMap(entryPoint => {
        const entryRows = semanticSupplementEligibleMutated.filter(run => queryForSemanticRun(run) === entryPoint);
        const keys = Array.from(new Set(entryRows.map(run => `${run.changeCategory}::${run.changeOperator}`))).sort();
        return keys.map(key => {
            const [category, operator] = key.split('::');
            const operatorRows = entryRows.filter(run => run.changeCategory === category && run.changeOperator === operator);
            const failures = operatorRows.filter(run => run.runStatus === 'failed').length;
            return {
                semantic_query: entryPoint,
                mutation_category: category,
                operator,
                eligible_mutated_runs: operatorRows.length,
                total_failures: failures,
                failure_rate: formatSupplementFailureRate(failures, operatorRows.length),
            };
        });
    });
    const thesisFacingSupplementWarnings = [
        ...semanticValidationWarnings.map(row => ({
            validation_type: row.validationType,
            application_id: row.applicationId,
            scenario_id: row.scenarioId,
            family: row.family,
            semantic_query: supplementScenarioEntries.find(entry => entry.scenarioId === row.scenarioId)?.intendedSemanticEntryPoint ?? null,
            message: row.message,
        })),
        ...semanticSupplementRows
            .filter(run => run.phase === 'mutated' && !run.comparisonEligible)
            .map(run => ({
                validation_type: run.mutationTelemetry?.finalMutationOutcomeClass && run.mutationTelemetry.finalMutationOutcomeClass !== 'applied'
                    ? 'mutation-not-applied-excluded'
                    : 'invalid-mutated-row-excluded',
                application_id: run.applicationId,
                scenario_id: run.activeScenarioId,
                family: run.locatorFamily,
                semantic_query: queryForSemanticRun(run) === 'none' ? null : queryForSemanticRun(run),
                message: run.comparisonExclusionReason && run.comparisonExclusionReason !== 'none'
                    ? run.comparisonExclusionReason
                    : 'Invalid or non-comparison-eligible mutated row was excluded from thesis-facing supplement denominators.',
            })),
        ...semanticSupplementEligibleMutated
            .filter(run => queryForSemanticRun(run) === 'none')
            .map(run => ({
                validation_type: 'missing-semantic-query-metadata',
                application_id: run.applicationId,
                scenario_id: run.activeScenarioId,
                family: run.locatorFamily,
                semantic_query: null,
                message: 'Eligible semantic-first supplement row is missing semantic query metadata and was not assigned to a thesis-facing query bucket.',
            })),
        ...(nonSemanticSupplementRowsExcluded > 0
            ? [{
                validation_type: 'non-semantic-family-rows-excluded',
                application_id: 'all',
                scenario_id: 'all',
                family: 'css|xpath|other',
                semantic_query: null,
                message: `${nonSemanticSupplementRowsExcluded} non-semantic supplement row(s) were found in raw artifacts and excluded from thesis-facing semantic supplement summaries.`,
            }]
            : []),
        ...thesisFacingSemanticEntryPoints
            .filter(entryPoint => (thesisFacingSupplementSummary.find(row => row.semantic_query === entryPoint)?.baseline_runs ?? 0) === 0 &&
                (thesisFacingSupplementSummary.find(row => row.semantic_query === entryPoint)?.eligible_mutated_runs ?? 0) === 0 &&
                (unsupportedCountByQuery[entryPoint] ?? 0) === 0 &&
                (supportedButNoValidMutationByQuery[entryPoint] ?? 0) === 0)
            .map(entryPoint => ({
                validation_type: 'query-absent-in-all-apps',
                application_id: 'all',
                scenario_id: 'all',
                family: 'semantic-first',
                semantic_query: entryPoint,
                message: `${entryPoint} has no supplement scenario evidence in any app.`,
            })),
        ...thesisFacingSupplementSummary
            .filter(row => row.baseline_runs > 0 && row.eligible_mutated_runs === 0)
            .map(row => ({
                validation_type: 'baseline-support-without-mutated-evidence',
                application_id: 'all',
                scenario_id: 'all',
                family: 'semantic-first',
                semantic_query: row.semantic_query,
                message: `${row.semantic_query} has baseline support but no comparison-eligible mutated supplement evidence.`,
            })),
        ...thesisFacingSupplementSummary
            .filter(row => row.eligible_mutated_runs > 0)
            .filter(row => new Set(semanticSupplementEligibleMutated
                .filter(run => queryForSemanticRun(run) === row.semantic_query)
                .map(run => run.applicationId)).size === 1)
            .map(row => ({
                validation_type: 'mutated-evidence-from-one-app',
                application_id: Array.from(new Set(semanticSupplementEligibleMutated
                    .filter(run => queryForSemanticRun(run) === row.semantic_query)
                    .map(run => run.applicationId))).join('|'),
                scenario_id: 'all',
                family: 'semantic-first',
                semantic_query: row.semantic_query,
                message: `${row.semantic_query} has comparison-eligible mutated evidence from only one app.`,
            })),
    ];
    const thesisFacingSupplementJson = {
        corpus: REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
        runMode: 'supplement',
        seed: supplementSeed,
        budget: supplementBudget,
        family: 'semantic-first',
        appsIncluded: semanticSupplementAppsForReporting,
        queries: Object.fromEntries(thesisFacingSupplementSummary.map(row => [
            row.semantic_query,
            {
                baselineRuns: row.baseline_runs,
                eligibleMutatedRuns: row.eligible_mutated_runs,
                totalFailures: row.total_failures,
                failureRate: row.failure_rate,
                unsupportedCount: row.unsupported_count,
                noValidCandidateCount: row.no_valid_candidate_count,
                supportedAppsWithBaseline: Array.from(appCountWithSupplementSupportByQuery.get(row.semantic_query) ?? []).sort(),
                byCategory: thesisFacingSupplementByCategory.filter(categoryRow => categoryRow.semantic_query === row.semantic_query),
                byOperator: thesisFacingSupplementByOperator.filter(operatorRow => operatorRow.semantic_query === row.semantic_query),
            },
        ])),
        totals: {
            baselineRuns: thesisFacingSupplementSummary.reduce((sum, row) => sum + row.baseline_runs, 0),
            eligibleMutatedRuns: thesisFacingSupplementSummary.reduce((sum, row) => sum + row.eligible_mutated_runs, 0),
            totalFailures: thesisFacingSupplementSummary.reduce((sum, row) => sum + row.total_failures, 0),
            failureRate: formatSupplementFailureRate(
                thesisFacingSupplementSummary.reduce((sum, row) => sum + row.total_failures, 0),
                thesisFacingSupplementSummary.reduce((sum, row) => sum + row.eligible_mutated_runs, 0),
            ),
            unsupportedCount: thesisFacingSupplementSummary.reduce((sum, row) => sum + row.unsupported_count, 0),
            noValidCandidateCount: thesisFacingSupplementSummary.reduce((sum, row) => sum + row.no_valid_candidate_count, 0),
            nonSemanticSupplementRowsExcluded,
            nonSupplementRowsExcluded,
        },
        warnings: thesisFacingSupplementWarnings,
    };

    if (isSemanticSupplement) {
        writeCsv(path.join(outputDir, 'semantic_query_distribution.csv'), semanticQueryDistribution);
        writeCsv(path.join(outputDir, 'semantic_scenario_query_mapping.csv'), semanticScenarioQueryMapping);
        writeCsv(path.join(outputDir, 'summary_by_semantic_query.csv'), summaryBySemanticQuery);
        writeCsv(path.join(outputDir, 'summary_by_semantic_query_and_category.csv'), summaryBySemanticQueryCategory);
        writeCsv(path.join(outputDir, 'failure_distribution_by_semantic_query.csv'), failureDistributionBySemanticQuery);
        writeCsv(path.join(outputDir, 'semantic_validation_warnings.csv'), semanticValidationWarnings);
        if (thesisFacingSemanticSupplement) {
            writeCsvWithHeaders(
                path.join(outputDir, 'semantic_supplement_summary.csv'),
                ['corpus', 'run_mode', 'seed', 'budget', 'family', 'semantic_query', 'baseline_runs', 'eligible_mutated_runs', 'total_failures', 'failure_rate', 'unsupported_count', 'no_valid_candidate_count'],
                thesisFacingSupplementSummary,
            );
            writeCsvWithHeaders(
                path.join(outputDir, 'semantic_supplement_by_category.csv'),
                ['semantic_query', 'mutation_category', 'eligible_mutated_runs', 'total_failures', 'failure_rate'],
                thesisFacingSupplementByCategory,
            );
            writeCsvWithHeaders(
                path.join(outputDir, 'semantic_supplement_by_operator.csv'),
                ['semantic_query', 'mutation_category', 'operator', 'eligible_mutated_runs', 'total_failures', 'failure_rate'],
                thesisFacingSupplementByOperator,
            );
            writeCsvWithHeaders(
                path.join(outputDir, 'semantic_supplement_validation_warnings.csv'),
                ['validation_type', 'application_id', 'scenario_id', 'family', 'semantic_query', 'message'],
                thesisFacingSupplementWarnings,
            );
            fs.writeFileSync(
                path.join(outputDir, 'semantic_supplement_summary.json'),
                JSON.stringify(thesisFacingSupplementJson, null, 2),
            );
        }
    }

    const accessibilityScanStatusSummary = families.map(family => {
        const familyRuns = runs.filter(run => run.locatorFamily === family);
        return {
            family,
            completedScans: familyRuns.filter(run => run.accessibilityScanStatus === 'completed').length,
            failedScans: familyRuns.filter(run => run.accessibilityScanStatus === 'failed').length,
            skippedScans: familyRuns.filter(run => run.accessibilityScanStatus === 'skipped').length,
        };
    });
    if (!thesisFacingSemanticSupplement) {
        writeCsv(path.join(outputDir, 'accessibility_scan_status_summary.csv'), accessibilityScanStatusSummary);
    }

    const accessibilitySummaryCompletedOnly = families.map(family => {
        const completedBaseline = baseline.filter(run => run.locatorFamily === family && run.runStatus !== 'invalid' && run.accessibilityScanStatus === 'completed');
        const completedMutated = mutated.filter(run => run.locatorFamily === family && run.runStatus !== 'invalid' && run.accessibilityScanStatus === 'completed');
        return {
            family,
            completedBaselineScans: completedBaseline.length,
            completedMutatedScans: completedMutated.length,
            meanViolationsBaselineCompletedOnly: mean(completedBaseline.map(run => run.totalViolations)).toFixed(2),
            meanViolationsMutatedCompletedOnly: mean(completedMutated.map(run => run.totalViolations)).toFixed(2),
            meanCriticalMutatedCompletedOnly: mean(completedMutated.map(run => run.criticalViolations)).toFixed(2),
            meanImpactedNodesMutatedCompletedOnly: mean(completedMutated.map(run => run.impactedNodes)).toFixed(2),
        };
    });
    if (!thesisFacingSemanticSupplement) {
        writeCsv(path.join(outputDir, 'accessibility_summary_completed_only.csv'), accessibilitySummaryCompletedOnly);
    }

    const accessibilitySummaryAllValidRuns = families.map(family => {
        const familyBaseline = baseline.filter(run => run.locatorFamily === family && run.runStatus !== 'invalid');
        const familyMutated = mutated.filter(run => run.locatorFamily === family && run.runStatus !== 'invalid');
        return {
            family,
            baselineValidRuns: familyBaseline.length,
            mutatedValidRuns: familyMutated.length,
            baselineCompletedScans: familyBaseline.filter(run => run.accessibilityScanStatus === 'completed').length,
            mutatedCompletedScans: familyMutated.filter(run => run.accessibilityScanStatus === 'completed').length,
            baselineFailedScans: familyBaseline.filter(run => run.accessibilityScanStatus === 'failed').length,
            mutatedFailedScans: familyMutated.filter(run => run.accessibilityScanStatus === 'failed').length,
            baselineSkippedScans: familyBaseline.filter(run => run.accessibilityScanStatus === 'skipped').length,
            mutatedSkippedScans: familyMutated.filter(run => run.accessibilityScanStatus === 'skipped').length,
            baselineCompletedScanRate: (familyBaseline.filter(run => run.accessibilityScanStatus === 'completed').length / familyBaseline.length || 0).toFixed(4),
            mutatedCompletedScanRate: (familyMutated.filter(run => run.accessibilityScanStatus === 'completed').length / familyMutated.length || 0).toFixed(4),
        };
    });
    if (!thesisFacingSemanticSupplement) {
        writeCsv(path.join(outputDir, 'accessibility_summary_all_valid_runs.csv'), accessibilitySummaryAllValidRuns);
    }

    const mutationRunTelemetry = mutated.map(run => ({
        runId: run.runId,
        applicationId: run.applicationId,
        browserName: run.browserName,
        corpusId: run.corpusId,
        activeScenarioId: run.activeScenarioId,
        locatorFamily: run.locatorFamily,
        changeOperator: run.changeOperator,
        changeCategory: run.changeCategory,
        operatorRuntimeCategory: run.mutationTelemetry?.operatorRuntimeCategory ?? null,
        operatorThesisCategory: run.mutationTelemetry?.operatorThesisCategory ?? null,
        selectedCandidateId: run.mutationTelemetry?.selectedCandidateId ?? null,
        selectedTargetSelector: run.mutationTelemetry?.selectedTargetSelector ?? null,
        selectedTargetTagType: run.mutationTelemetry?.selectedTargetTagType ?? null,
        operatorConsideredCandidateCount: run.mutationTelemetry?.operatorConsideredCandidateCount ?? null,
        operatorCandidateCount: run.mutationTelemetry?.operatorCandidateCount ?? null,
        operatorApplicableCount: run.mutationTelemetry?.operatorApplicableCount ?? null,
        operatorSkippedOracleCount: run.mutationTelemetry?.operatorSkippedOracleCount ?? null,
        operatorNotApplicableCount: run.mutationTelemetry?.operatorNotApplicableCount ?? null,
        operatorSelectedCount: run.mutationTelemetry?.operatorSelectedCount ?? null,
        operatorSelectedApplicableRatio: run.mutationTelemetry?.operatorSelectedApplicableRatio ?? null,
        operatorCheckDurationMs: run.mutationTelemetry?.operatorCheckDurationMs ?? null,
        applyDurationMs: run.mutationTelemetry?.applyDurationMs ?? null,
        applyFailureCount: run.mutationTelemetry?.applyFailureCount ?? 0,
        finalMutationOutcomeClass: run.mutationTelemetry?.finalMutationOutcomeClass ?? null,
    }));
    if (!thesisFacingSemanticSupplement) {
        writeCsv(path.join(outputDir, 'mutation_run_telemetry.csv'), mutationRunTelemetry);
    }

    const operatorCoverageRows = reachableTargetsPayload?.metadata?.operatorCoverage ?? [];
    const operatorCoverageByName = new Map(operatorCoverageRows.map(row => [row.operator, row]));
    const heavilyBlockedByOracleOperators = new Set(scenarioPayload?.metadata?.heavilyBlockedByOracleOperators ?? []);
    const applicableButUnselectedOperators = scenarioPayload?.metadata?.applicableButUnselectedOperators ?? {};

    const operatorTelemetrySummary = operators.map(operator => {
        const operatorRuns = mutated.filter(run => run.changeOperator === operator);
        const coverage = operatorCoverageByName.get(operator);
        return {
            operator,
            totalMutatedRuns: operatorRuns.length,
            distinctSelectedCandidates: new Set(operatorRuns.map(run => run.mutationTelemetry?.selectedCandidateId).filter(Boolean)).size,
            totalCandidateCount: coverage?.candidateCount ?? 0,
            totalConsideredCandidateCount: operatorRuns.reduce((sum, run) => sum + (run.mutationTelemetry?.operatorConsideredCandidateCount ?? 0), 0),
            totalApplicableCount: coverage?.applicableCount ?? 0,
            totalSkippedOracleCount: coverage?.skippedOracleCount ?? 0,
            totalNotApplicableCount: coverage?.notApplicableCount ?? 0,
            totalCheckDurationMs: coverage?.totalCheckDurationMs ?? 0,
            totalApplyDurationMs: operatorRuns.reduce((sum, run) => sum + (run.mutationTelemetry?.applyDurationMs ?? 0), 0),
            totalApplyFailures: operatorRuns.reduce((sum, run) => sum + (run.mutationTelemetry?.applyFailureCount ?? 0), 0),
            sampledTargetSelectors: JSON.stringify(
                Array.from(new Set(operatorRuns.map(run => run.mutationTelemetry?.selectedTargetSelector).filter(Boolean))).slice(0, 5),
            ),
            finalOutcomeClasses: JSON.stringify(
                operatorRuns.reduce((acc, run) => {
                    const outcome = run.mutationTelemetry?.finalMutationOutcomeClass;
                    if (outcome) {
                        acc[outcome] = (acc[outcome] || 0) + 1;
                    }
                    return acc;
                }, {} as Record<string, number>),
            ),
        };
    });
    if (!thesisFacingSemanticSupplement) {
        writeCsv(path.join(outputDir, 'operator_telemetry_summary.csv'), operatorTelemetrySummary);
    }

    const cssXpathPairs = [...mutated.reduce((acc, run) => {
        if (!run.comparisonEligible || !isCssOrXpathFamily(run.locatorFamily)) {
            return acc;
        }
        const key = pairKey(run);
        const bucket = acc.get(key) ?? {};
        bucket[run.locatorFamily] = run;
        acc.set(key, bucket);
        return acc;
    }, new Map<string, Partial<Record<'css' | 'xpath', AggregatedRun>>>()).entries()]
        .map(([key, pair]) => ({ key, css: pair.css, xpath: pair.xpath }))
        .filter((pair): pair is { key: string; css: AggregatedRun; xpath: AggregatedRun } => Boolean(pair.css && pair.xpath));

    const cssXpathDiscordanceRows = cssXpathPairs.map(pair => {
        const cssOutcome = outcomeSignature(pair.css);
        const xpathOutcome = outcomeSignature(pair.xpath);
        return {
            applicationId: pair.css.applicationId,
            browserName: pair.css.browserName,
            activeScenarioId: pair.css.activeScenarioId,
            changeId: pair.css.changeId,
            changeCategory: pair.css.changeCategory,
            changeOperator: pair.css.changeOperator,
            cssOutcome,
            xpathOutcome,
            discordant: cssOutcome !== xpathOutcome,
        };
    });
    if (!thesisFacingSemanticSupplement) {
        writeCsv(path.join(outputDir, 'css_xpath_discordance.csv'), cssXpathDiscordanceRows);
    }

    const summarizeDiscordance = (rows: typeof cssXpathDiscordanceRows, dimension: 'overall' | 'changeCategory' | 'changeOperator') => {
        const groups = new Map<string, typeof cssXpathDiscordanceRows>();
        for (const row of rows) {
            const key = dimension === 'overall' ? 'overall' : String(row[dimension]);
            const bucket = groups.get(key) ?? [];
            bucket.push(row);
            groups.set(key, bucket);
        }
        return [...groups.entries()].map(([key, bucket]) => ({
            [dimension]: key,
            pairedRuns: bucket.length,
            discordantPairs: bucket.filter(row => row.discordant).length,
            discordanceRate: (bucket.filter(row => row.discordant).length / bucket.length || 0).toFixed(4),
        }));
    };

    if (!thesisFacingSemanticSupplement) {
        writeCsv(path.join(outputDir, 'css_xpath_discordance_summary.csv'), summarizeDiscordance(cssXpathDiscordanceRows, 'overall'));
        writeCsv(path.join(outputDir, 'css_xpath_discordance_by_category.csv'), summarizeDiscordance(cssXpathDiscordanceRows, 'changeCategory'));
        writeCsv(path.join(outputDir, 'css_xpath_discordance_by_operator.csv'), summarizeDiscordance(cssXpathDiscordanceRows, 'changeOperator'));
    }

    const operatorDiversitySummary = [...new Set([...operators, ...Object.keys(scenarioPayload?.metadata?.availableCountsByOperator ?? {})])]
        .sort()
        .map(operator => {
            const applicableCount = scenarioPayload?.metadata?.availableCountsByOperator?.[operator] ?? operatorCoverageByName.get(operator)?.applicableCount ?? 0;
            const selectedCount = scenarioPayload?.metadata?.selectedCountsByOperator?.[operator] ?? 0;
            const selectedApplicableRatio =
                scenarioPayload?.metadata?.selectedApplicableRatiosByOperator?.[operator] ??
                (applicableCount > 0 ? selectedCount / applicableCount : 0);
            const unselectedCategories = Object.entries(applicableButUnselectedOperators)
                .filter(([, operatorsForCategory]) => operatorsForCategory.includes(operator))
                .map(([category]) => category)
                .sort();
            const pairedRuns = cssXpathDiscordanceRows.filter(row => row.changeOperator === operator).length;
            const discordantPairs = cssXpathDiscordanceRows.filter(
                row => row.changeOperator === operator && row.discordant,
            ).length;

            return {
                operator,
                applicableCandidateCount: applicableCount,
                selectedCandidateCount: selectedCount,
                selectedApplicableRatio: selectedApplicableRatio.toFixed(4),
                candidateCount: operatorCoverageByName.get(operator)?.candidateCount ?? 0,
                skippedOracleCount: operatorCoverageByName.get(operator)?.skippedOracleCount ?? 0,
                notApplicableCount: operatorCoverageByName.get(operator)?.notApplicableCount ?? 0,
                applicableButUnselected: selectedCount === 0 && applicableCount > 0,
                unselectedCategories: JSON.stringify(unselectedCategories),
                heavilyBlockedByOracle: heavilyBlockedByOracleOperators.has(operator),
                pairedRuns,
                discordantPairs,
                discordanceRate: (discordantPairs / pairedRuns || 0).toFixed(4),
            };
        });
    if (!thesisFacingSemanticSupplement) {
        writeCsv(path.join(outputDir, 'operator_diversity_summary.csv'), operatorDiversitySummary);
    }

    const selectedScenarios = scenarioPayload?.scenarios ?? [];
    if (selectedScenarios.length > 0) {
        const selectionSummaryByCategoryAndRelevance = CATEGORY_ORDER.flatMap(category => {
            const categoryRows = selectedScenarios.filter(scenario =>
                (scenario.quotaBucket ?? scenario.operatorRuntimeCategory ?? scenario.operator?.category ?? 'unknown') === category,
            );
            const relevanceBands = Array.from(new Set(categoryRows.map(scenario => scenario.relevanceBand ?? 'generic'))).sort();
            return relevanceBands.map(relevanceBand => ({
                category,
                relevanceBand,
                selectedCount: categoryRows.filter(scenario => (scenario.relevanceBand ?? 'generic') === relevanceBand).length,
                selectedForCategoryMinimumCount: categoryRows.filter(
                    scenario => (scenario.relevanceBand ?? 'generic') === relevanceBand && scenario.selectedForCategoryMinimum === true,
                ).length,
            }));
        }).filter(row => row.selectedCount > 0);
        if (!thesisFacingSemanticSupplement) {
            writeCsv(path.join(outputDir, 'selection_summary_by_category_and_relevance.csv'), selectionSummaryByCategoryAndRelevance);
        }

        const selectionTouchpointSummary = [
            {
                selectionType: 'selected',
                touchpointRelevantCount: selectedScenarios.filter(scenario => (scenario.touchpointLogicalKeys ?? []).length > 0).length,
                genericCount: selectedScenarios.filter(scenario => (scenario.touchpointLogicalKeys ?? []).length === 0).length,
                mandatoryCoverageSatisfied: scenarioPayload?.metadata?.mandatoryCoverageSatisfied ?? false,
            },
        ];
        if (!thesisFacingSemanticSupplement) {
            writeCsv(path.join(outputDir, 'selection_touchpoint_summary.csv'), selectionTouchpointSummary);
        }
    }

    const preflightResults = preflightPayload?.results ?? [];
    if (preflightResults.length > 0) {
        const successfulResults = preflightResults.filter(result => result.success);
        const preflightValidatedSummary = CATEGORY_ORDER.flatMap(category => {
            const categoryRows = successfulResults.filter(result => (result.operatorCategory ?? 'unknown') === category);
            const relevanceBands = Array.from(new Set(categoryRows.map(result => result.relevanceBand ?? 'generic'))).sort();
            return relevanceBands.map(relevanceBand => ({
                category,
                relevanceBand,
                validatedCount: categoryRows.filter(result => (result.relevanceBand ?? 'generic') === relevanceBand).length,
                meaningfulValidatedCount: categoryRows.filter(
                    result => (result.relevanceBand ?? 'generic') === relevanceBand && result.meaningfulEffect !== false,
                ).length,
            }));
        }).filter(row => row.validatedCount > 0);
        if (!thesisFacingSemanticSupplement) {
            writeCsv(path.join(outputDir, 'preflight_validated_summary_by_category_and_relevance.csv'), preflightValidatedSummary);
        }
    }

    const semanticSupplementReport = isSemanticSupplement
        ? {
            corpusId: REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
            corpusRole: 'supplementary',
            reportRole: thesisFacingSemanticSupplement ? 'canonical-thesis-facing-semantic-supplement' : 'debug-supplement-aggregate',
            notPooledIntoPrimaryDenominators: true,
            primaryCorpusId: 'realworld-active',
            interpretationBoundary: thesisFacingSemanticSupplement
                ? 'Canonical thesis-facing supplement aggregate: supplementary semantic-first coverage evidence only; not a second primary benchmark and not pooled into the main thesis benchmark denominator.'
                : 'Supplementary semantic-coverage evidence only; app-level supplement aggregates are debug outputs and are not pooled into the main thesis benchmark denominator.',
            appsIncluded: semanticSupplementAppsForReporting,
            scenariosIncluded: supplementScenarioEntries.map(entry => entry.scenarioId),
            familiesIncluded: families,
            seeds: Array.from(new Set([...scenarioPayloadsByApp.values()].map(payload => payload.metadata?.seed).filter(value => value !== undefined))),
            budgets: Array.from(new Set([...scenarioPayloadsByApp.values()].map(payload => payload.metadata?.budget).filter(value => value !== undefined))),
            supportedAppScenarioMatrix: semanticScenarioQueryMapping,
            queryDistribution: {
                baselineSemanticSupportDistribution,
                mutatedSemanticEvidenceDistribution,
                rows: semanticQueryDistribution,
            },
            scenarioToQueryMapping: semanticScenarioQueryMapping,
            summaryBySemanticQuery,
            summaryBySemanticQueryCategory,
            failureDistributionBySemanticQuery,
            mutationCategoryBreakdownByQuery: summaryBySemanticQueryCategory,
            failureClassBreakdownByQuery: failureDistributionBySemanticQuery,
            excludedAppScenarioPairs: semanticSupplementExclusions,
            semanticFirstSummary: {
                baselineRuns: semanticSupplementBaseline.length,
                mutatedRuns: semanticSupplementMutated.length,
                comparisonEligibleMutatedRuns: semanticSupplementEligibleMutated.length,
                failures: semanticSupplementEligibleMutated.filter(run => run.runStatus === 'failed').length,
                failureRate: (
                    semanticSupplementEligibleMutated.filter(run => run.runStatus === 'failed').length /
                    semanticSupplementEligibleMutated.length || 0
                ).toFixed(4),
            },
            validation: {
                warnings: semanticValidationWarnings,
                nonSemanticSupplementRowsExcluded,
                nonSupplementRowsExcluded,
                eligibleMutatedSemanticFirstRows: semanticSupplementEligibleMutated.length,
            },
            transparency: {
                notPooledIntoPrimaryThesisDenominator: true,
                supplementarySemanticCoverageEvidenceOnly: true,
                canonicalThesisFacingAggregate: thesisFacingSemanticSupplement,
                notASecondPrimaryBenchmark: true,
                baselineOnlySupportIsNotMutationEvidence: true,
                baselineOnlyNote: 'Queries with baseline support and zero eligible mutated runs are reported as baseline-only support, not mutated semantic evidence.',
                mainCorpusId: 'realworld-active',
            },
        }
        : null;

    const report = thesisFacingSemanticSupplement
        ? {
            generatedAt: new Date().toISOString(),
            corpusId: REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
            reportRole: 'canonical-thesis-facing-semantic-supplement',
            activeScenarioIds,
            applications: appSummary,
            browsers: browserSummary,
            semanticSupplement: semanticSupplementReport,
        }
        : {
        generatedAt: new Date().toISOString(),
        corpusId: corpusIds.length === 1 ? corpusIds[0] : corpusIds,
        activeScenarioIds,
        applications: appSummary,
        browsers: browserSummary,
        summaryByBrowserFamily,
        summaryByBrowserFamilyCategory,
        summaryByFamily,
        summaryByFamilyCategory,
        summaryByFamilyOperator,
        failureDistribution: failureDist,
        comparisonDenominators,
        ...(semanticSupplementReport ? { semanticSupplement: semanticSupplementReport } : {}),
        exclusions: exclusionSummary,
        accessibility: {
            scanStatusSummary: accessibilityScanStatusSummary,
            completedOnly: accessibilitySummaryCompletedOnly,
            allValidRuns: accessibilitySummaryAllValidRuns,
        },
        selectionQuality: {
            selectedCounts: scenarioPayload?.metadata?.selectedCounts ?? null,
            availableCountsByOperator: scenarioPayload?.metadata?.availableCountsByOperator ?? null,
            selectedCountsByOperator: scenarioPayload?.metadata?.selectedCountsByOperator ?? null,
            selectedApplicableRatiosByOperator: scenarioPayload?.metadata?.selectedApplicableRatiosByOperator ?? null,
            applicableButUnselectedOperators: scenarioPayload?.metadata?.applicableButUnselectedOperators ?? null,
            heavilyBlockedByOracleOperators: scenarioPayload?.metadata?.heavilyBlockedByOracleOperators ?? null,
            validatedCountsByCategory: scenarioPayload?.metadata?.validatedCountsByCategory ?? preflightPayload?.metadata?.successfulCountsByCategory ?? null,
            validatedCountsByOperator: scenarioPayload?.metadata?.validatedCountsByOperator ?? preflightPayload?.metadata?.successfulCountsByOperator ?? null,
            mandatoryCoverageSatisfied: scenarioPayload?.metadata?.mandatoryCoverageSatisfied ?? null,
            selectedTouchpointRelevantCount: selectedScenarios.filter(scenario => (scenario.touchpointLogicalKeys ?? []).length > 0).length,
            selectedGenericCount: selectedScenarios.filter(scenario => (scenario.touchpointLogicalKeys ?? []).length === 0).length,
        },
        mutationRunTelemetry,
        operatorTelemetrySummary,
        operatorDiversitySummary,
        cssXpathDiscordance: {
            pairedRuns: cssXpathDiscordanceRows.length,
            discordantPairs: cssXpathDiscordanceRows.filter(row => row.discordant).length,
            overallRate: (cssXpathDiscordanceRows.filter(row => row.discordant).length / cssXpathDiscordanceRows.length || 0).toFixed(4),
            rows: cssXpathDiscordanceRows,
        },
        operatorCounts: operators.map(operator => ({
            operator,
            totalMutated: mutated.filter(run => run.changeOperator === operator).length,
            comparableMutated: mutated.filter(run => run.changeOperator === operator && run.comparisonEligible).length,
        })),
        categoryCounts: categories.map(category => ({
            category,
            totalMutated: mutated.filter(run => run.changeCategory === category).length,
            comparableMutated: mutated.filter(run => run.changeCategory === category && run.comparisonEligible).length,
        })),
        excludedUnsupported: unsupportedRows,
    };
    fs.writeFileSync(path.join(outputDir, 'aggregate_report.json'), JSON.stringify(report, null, 2));
    const metadata = createRunMetadata({
        runId: `aggregate-${Date.now()}`,
        generatedAt: report.generatedAt,
        applicationId: appsInRuns.length === 1 ? appsInRuns[0] : 'multi-app',
        browserName: browserSummary.length === 1 ? browserSummary[0].browserName : 'chromium',
        corpusId: corpusIds.length === 1 ? corpusIds[0] : corpusIds.join('|'),
        browserSetUsed: browserNames,
        selectedScenarios: activeScenarioIds,
        selectedApps: appsInRuns,
        selectedMutationIds: mutated.map(run => run.changeId).filter(changeId => changeId && changeId !== 'none'),
        totalCandidatesConsidered: mutated.length,
        executionMode: 'aggregate',
    });
    fs.writeFileSync(path.join(outputDir, 'run-metadata.json'), JSON.stringify(metadata, null, 2));

    console.log(`Aggregation complete. Results written to ${outputDir}`);
}

export function getDefaultAggregateOutputDir(appResultsDir: string, corpusId = process.env.BENCHMARK_CORPUS_ID): string {
    return corpusId === REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID
        ? path.join(appResultsDir, 'debug', 'app-aggregate')
        : path.join(appResultsDir, 'aggregate');
}

export function demoteLegacySupplementAppAggregate(appResultsDir: string, outputDir: string): void {
    const legacyOutputDir = path.join(appResultsDir, 'aggregate');
    const deprecatedOutputDir = path.join(appResultsDir, 'debug', 'deprecated-app-aggregate');
    if (path.resolve(outputDir) === path.resolve(legacyOutputDir) || !fs.existsSync(legacyOutputDir)) {
        return;
    }

    fs.rmSync(deprecatedOutputDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(deprecatedOutputDir), { recursive: true });
    fs.renameSync(legacyOutputDir, deprecatedOutputDir);
    fs.writeFileSync(
        path.join(deprecatedOutputDir, 'NONCANONICAL_DEPRECATED_SUPPLEMENT_APP_AGGREGATE.md'),
        [
            '# Deprecated Supplement App Aggregate',
            '',
            'This app-level supplement aggregate was moved out of the default supplement artifact path.',
            'It is retained only as engineering/debug output and must not be cited as the thesis-facing semantic supplement aggregate.',
            'Use the combined canonical supplement aggregate at test-results/realworld-semantic-supplement/thesis-facing-aggregate/.',
            '',
        ].join('\n'),
    );
}

function main() {
    const args = process.argv.slice(2);
    const selectedAppId = getSelectedAppId();
    const defaultAppResultsDir = getAppResultsDir(selectedAppId);
    const inputDir = path.resolve(args[0] || path.join(defaultAppResultsDir, 'benchmark-runs'));
    const isSupplementAppAggregate = process.env.BENCHMARK_CORPUS_ID === REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID;
    const defaultOutputDir = getDefaultAggregateOutputDir(defaultAppResultsDir);
    const outputDir = path.resolve(args[1] || defaultOutputDir);

    if (!fs.existsSync(inputDir)) {
        console.error(`Input directory does not exist: ${inputDir}`);
        process.exit(1);
    }

    const runs = loadResults(inputDir);
    if (runs.length === 0) {
        console.error('No valid results found to aggregate.');
        process.exit(1);
    }

    if (isSupplementAppAggregate && args[1] === undefined) {
        demoteLegacySupplementAppAggregate(defaultAppResultsDir, outputDir);
    }

    aggregate(runs, outputDir);

    const retention = getBenchmarkRetention();
    const cleanup = pruneCompactBenchmarkArtifacts({
        inputDir,
        outputDir,
        additionalDirs: [path.join(path.dirname(inputDir), 'accessibility-artifacts')],
        retention,
    });

    if (cleanup.removedPaths.length > 0) {
        console.log(`Compact retention pruned raw benchmark artifacts: ${cleanup.removedPaths.join(', ')}`);
    }
}

if (require.main === module) {
    main();
}
