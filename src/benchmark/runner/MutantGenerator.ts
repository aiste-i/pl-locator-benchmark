import { Page } from 'playwright';
import { MutationCandidate } from '../../webmutator/MutationCandidate';
import { DomOperator } from '../../webmutator/operators/dom/DomOperator';
import { OperatorRegistry } from '../../webmutator/operators/OperatorRegistry';
import { OracleSafety } from '../../webmutator/utils/OracleSafety';
import {
    getBenchmarkOperatorCatalog,
    type OperatorCatalogEntry,
    type ThesisMutationCategory,
} from '../../webmutator/operators/catalog';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { getAppReachableTargetsPath } from '../../apps';
import {
    REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
    getBenchmarkCorpusId,
    getSemanticSupplementScenarioEntriesForApp,
} from '../../benchmark/realworld-corpus';
import {
    annotateTargetRelevance,
    categoryAvailabilityHint,
    type FamilyStressHints,
    type RelevanceBand,
    type ScenarioTouchpoint,
} from '../../benchmark/realworld-touchpoints';
import {
    buildMutationPreflightPool,
    buildSemanticSupplementPreflightPool,
    getCandidateCategory,
    sampleMutationCandidates,
    sampleSemanticSupplementMutationCandidates,
    type SemanticScenarioCoverageRow,
} from './sampling';

export interface ReachableTargetContext {
    scenarioId: string;
    scenarioCategory: string;
    sourceSpec: string;
    viewContext: string;
    logicalKey?: string | null;
    touchpoints?: ScenarioTouchpoint[];
}

export interface ReachableTarget {
    applicationId: string;
    corpusId?: string;
    scenarioId: string;
    scenarioCategory: string;
    sourceSpec: string;
    viewContext: string;
    logicalKey?: string | null;
    url: string;
    selector: string;
    fingerprint: {
        role: string;
        name: string;
        tagType: string;
        stableAttributes: Record<string, string>;
    };
    oracleProtected: boolean;
    eligible: boolean;
    exclusionReason: string | null;
    eligibleOperators: string[];
    eligibleCategories: string[];
    touchpointLogicalKeys: string[];
    relevanceBand: RelevanceBand;
    familyStressHints: FamilyStressHints;
    relevanceScore: number;
}

export interface OperatorCoverageTelemetry {
    operator: string;
    runtimeCategory: DomOperator['category'];
    thesisCategory: ThesisMutationCategory;
    candidateCount: number;
    applicableCount: number;
    skippedOracleCount: number;
    notApplicableCount: number;
    totalCheckDurationMs: number;
    appliedCount: number;
    applyDurationMs: number;
    applyFailureCount: number;
    finalOutcomeClasses: Record<string, number>;
}

interface SavedTargetRegistry {
    metadata: {
        applicationId: string;
        corpusId?: string;
        generatedAt: string;
        totalTargets: number;
        activeScenarioIds: string[];
        operatorCoverage: OperatorCoverageTelemetry[];
    };
    targets: ReachableTarget[];
}

interface SavedScenarioSet {
    metadata: {
        applicationId: string;
        corpusId?: string;
        generatedAt: string;
        totalCandidates: number;
        totalEligibleCandidates: number;
        budget: number;
        seed: number;
        categoryQuotas: Record<string, number>;
        selectedCounts: Record<string, number>;
        availableCountsByCategory?: Record<string, number>;
        availableCountsByOperator?: Record<string, number>;
        selectedCountsByOperator?: Record<string, number>;
        selectedApplicableRatiosByOperator?: Record<string, number>;
        applicableButUnselectedOperators?: Record<string, string[]>;
        heavilyBlockedByOracleOperators?: string[];
        mandatoryCoverageSatisfied?: boolean;
        semanticScenarioCoverage?: SemanticScenarioCoverageRow[];
        semanticScenarioCoverageSatisfied?: boolean;
        validatedCountsByCategory?: Record<string, number>;
        validatedCountsByOperator?: Record<string, number>;
        activeScenarioIds: string[];
    };
    scenarios: ReturnType<MutationCandidate['toJSON']>[];
}

const DEFAULT_SEMANTIC_SUPPLEMENT_COLLECT_BUDGET_MS = 24_000;

export class MutantGenerator {
    private page: Page;
    private appName: string;
    private targetRegistry: Map<string, ReachableTarget> = new Map();
    private registryPath: string;
    private corpusId?: string;
    private lastSamplingSummary: SavedScenarioSet['metadata'] | null = null;
    private operatorCoverage: Map<string, OperatorCoverageTelemetry> = new Map();

    constructor(page: Page, appName: string = 'default') {
        this.page = page;
        this.appName = appName;
        this.registryPath = getAppReachableTargetsPath(this.appName as any);
        this.corpusId = getBenchmarkCorpusId();
        this.loadRegistryFromFile();
    }

    private ensureOperatorCoverageEntry(entry: OperatorCatalogEntry): OperatorCoverageTelemetry {
        const existing = this.operatorCoverage.get(entry.type);
        if (existing) {
            return existing;
        }

        const created: OperatorCoverageTelemetry = {
            operator: entry.type,
            runtimeCategory: entry.runtimeCategory as DomOperator['category'],
            thesisCategory: entry.thesisCategory,
            candidateCount: 0,
            applicableCount: 0,
            skippedOracleCount: 0,
            notApplicableCount: 0,
            totalCheckDurationMs: 0,
            appliedCount: 0,
            applyDurationMs: 0,
            applyFailureCount: 0,
            finalOutcomeClasses: {},
        };
        this.operatorCoverage.set(entry.type, created);
        return created;
    }

    private getOperatorCoverageRows(): OperatorCoverageTelemetry[] {
        return [...this.operatorCoverage.values()].sort((left, right) => left.operator.localeCompare(right.operator));
    }

    private buildTargetRegistryKey(target: ReachableTarget): string {
        return [
            target.applicationId,
            target.corpusId ?? 'no-corpus',
            target.scenarioId,
            target.viewContext,
            target.url,
            target.selector,
        ].join('::');
    }

    private buildCandidateId(target: ReachableTarget, operator: DomOperator): string {
        return createHash('sha1')
            .update([
                target.applicationId,
                target.corpusId ?? 'no-corpus',
                target.scenarioId,
                target.viewContext,
                target.url,
                target.selector,
                operator.constructor.name,
            ].join('::'))
            .digest('hex');
    }

    private loadRegistryFromFile() {
        if (!fs.existsSync(this.registryPath)) {
            return;
        }

        try {
            const data = JSON.parse(fs.readFileSync(this.registryPath, 'utf8'));
            const targets = Array.isArray(data) ? data : data.targets;
            const operatorCoverage = Array.isArray(data?.metadata?.operatorCoverage) ? data.metadata.operatorCoverage : [];
            for (const row of operatorCoverage as OperatorCoverageTelemetry[]) {
                this.operatorCoverage.set(row.operator, row);
            }
            for (const item of targets as ReachableTarget[]) {
                if (!item?.scenarioId || !item?.viewContext || !item?.applicationId) {
                    continue;
                }
                const key = this.buildTargetRegistryKey(item);
                this.targetRegistry.set(key, item);
            }
        } catch (e) {
            console.error('Failed to load target registry:', e);
        }
    }

    async saveRegistryToFile() {
        const dir = path.dirname(this.registryPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const targets = Array.from(this.targetRegistry.values());
        const payload: SavedTargetRegistry = {
            metadata: {
                applicationId: this.appName,
                corpusId: this.corpusId,
                generatedAt: new Date().toISOString(),
                totalTargets: targets.length,
                activeScenarioIds: [...new Set(targets.map(target => target.scenarioId).filter(Boolean))].sort(),
                operatorCoverage: this.getOperatorCoverageRows(),
            },
            targets,
        };
        fs.writeFileSync(this.registryPath, JSON.stringify(payload, null, 2));
    }

    async collectReachableTargets(context: ReachableTargetContext): Promise<ReachableTarget[]> {
        if (!this.page) {
            throw new Error('collectReachableTargets requires an active Playwright page.');
        }

        const url = this.page.url();
        const foundTargets = await this.page.evaluate(() => {
            const getFingerprint = (element: Element) => {
                const attributes: Record<string, string> = {};
                const stableAttrNames = ['id', 'name', 'class', 'data-testid', 'role', 'type'];
                for (const name of stableAttrNames) {
                    const val = element.getAttribute(name);
                    if (val) attributes[name] = val;
                }

                return {
                    role: element.getAttribute('role') || '',
                    name: element.getAttribute('name') || '',
                    tagType: element.tagName.toLowerCase(),
                    stableAttributes: attributes
                };
            };

            const getSelector = (element: Element): string => {
                const testId = element.getAttribute('data-testid');
                if (testId) return `[data-testid="${testId}"]`;
                if (element.id) return `#${element.id}`;
                const path: string[] = [];
                let current: Element | null = element;
                while (current && current !== document.body) {
                    let selector = current.tagName.toLowerCase();
                    if (current.parentElement) {
                        const siblings = Array.from(current.parentElement.children).filter(e => e.tagName === current?.tagName);
                        if (siblings.length > 1) {
                            selector += `:nth-of-type(${siblings.indexOf(current) + 1})`;
                        }
                    }
                    path.unshift(selector);
                    current = current.parentElement;
                }
                return path.join(' > ');
            };

            const closestSelector = (element: Element, matcher: (candidate: Element) => boolean): string | null => {
                let current: Element | null = element;
                while (current && current !== document.body) {
                    if (matcher(current)) {
                        return getSelector(current);
                    }
                    current = current.parentElement;
                }
                return null;
            };

            const accessibleMatcher = (candidate: Element) =>
                ['button', 'a', 'label', 'input', 'textarea', 'select', 'option'].includes(candidate.tagName.toLowerCase()) ||
                /^h[1-6]$/.test(candidate.tagName.toLowerCase()) ||
                candidate.hasAttribute('aria-label') ||
                candidate.hasAttribute('aria-labelledby') ||
                candidate.hasAttribute('placeholder') ||
                candidate.hasAttribute('alt') ||
                candidate.hasAttribute('title') ||
                candidate.hasAttribute('role');

            const actionableMatcher = (candidate: Element) =>
                ['button', 'a', 'input', 'textarea', 'select', 'form'].includes(candidate.tagName.toLowerCase()) ||
                candidate.getAttribute('role') === 'button' ||
                candidate.getAttribute('role') === 'link';

            const collectionMatcher = (candidate: Element) =>
                ['article', 'li'].includes(candidate.tagName.toLowerCase()) ||
                candidate.classList.contains('article-preview') ||
                candidate.classList.contains('article-meta') ||
                candidate.classList.contains('card') ||
                candidate.getAttribute('data-testid')?.startsWith('comment-card-') === true;

            const elements = Array.from(document.querySelectorAll('button, input, textarea, a, h1, h2, h3, p, div, span, li, label, article, aside, footer, form, header, main, nav, section, search, select, ul, img'));
            return elements
                .filter(el => {
                    const style = window.getComputedStyle(el);
                    const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
                    return isVisible;
                })
                .map(el => ({
                    selector: getSelector(el),
                    stableSelector: el.getAttribute('data-testid')
                        ? `[data-testid="${el.getAttribute('data-testid')}"]`
                        : (el.id ? `#${el.id}` : null),
                    fingerprint: getFingerprint(el),
                    accessibleNameSurfaceSelector: closestSelector(el, accessibleMatcher),
                    actionableContainerSelector: closestSelector(el, actionableMatcher),
                    collectionItemSelector: closestSelector(el, collectionMatcher),
                }));
        });

        const operatorCatalog = getBenchmarkOperatorCatalog();
        const operators = operatorCatalog.map(entry => ({
            entry,
            operator: entry.factory(),
        }));

        const isSemanticSupplementTouchpointCollection =
            this.corpusId === REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID &&
            Boolean(context.touchpoints?.length);
        const collectionBudgetMs = Number(
            process.env.SEMANTIC_SUPPLEMENT_COLLECT_BUDGET_MS ??
            DEFAULT_SEMANTIC_SUPPLEMENT_COLLECT_BUDGET_MS,
        );
        const semanticSupplementCollectionDeadlineMs = isSemanticSupplementTouchpointCollection
            ? Date.now() + Math.max(0, collectionBudgetMs)
            : Number.POSITIVE_INFINITY;
        const targetsForApplicabilityChecks = foundTargets
            .map(discovered => {
                const annotation = context.touchpoints?.length
                    ? annotateTargetRelevance(
                        {
                            selector: discovered.selector,
                            stableSelector: discovered.stableSelector ?? null,
                            tagType: discovered.fingerprint.tagType,
                            role: discovered.fingerprint.role,
                            accessibleNameSurfaceSelector: discovered.accessibleNameSurfaceSelector ?? null,
                            actionableContainerSelector: discovered.actionableContainerSelector ?? null,
                            collectionItemSelector: discovered.collectionItemSelector ?? null,
                        },
                        context.touchpoints,
                    )
                    : null;
                return { discovered, annotation };
            })
            .filter(({ annotation }) => !isSemanticSupplementTouchpointCollection || annotation?.relevanceBand !== 'generic')
            .sort((left, right) => (right.annotation?.relevanceScore ?? 0) - (left.annotation?.relevanceScore ?? 0));

        for (const { discovered, annotation } of targetsForApplicabilityChecks) {
            if (
                isSemanticSupplementTouchpointCollection &&
                Date.now() >= semanticSupplementCollectionDeadlineMs &&
                annotation?.relevanceBand !== 'exact-touchpoint'
            ) {
                continue;
            }

            const locator = this.page.locator(discovered.selector).first();
            if (await locator.count() === 0) {
                continue;
            }

            const protectionKind = await OracleSafety.getProtectionKind(locator);
            const oracleProtected = protectionKind !== 'none';
            const eligibleOperators: string[] = [];
            const eligibleCategories = new Set<string>();

            for (const { entry, operator } of operators) {
                const coverage = this.ensureOperatorCoverageEntry(entry);
                coverage.candidateCount += 1;

                const directAnchorAllowed = protectionKind === 'direct-anchor' && operator.oracleAnchorSafe === true;
                const blockedByOracle =
                    protectionKind === 'contains-anchor-descendant' ||
                    (protectionKind === 'direct-anchor' && !directAnchorAllowed);

                if (blockedByOracle) {
                    coverage.skippedOracleCount += 1;
                    continue;
                }

                const startedAt = Date.now();
                try {
                    const applicable = await operator.isApplicable(this.page, locator);
                    coverage.totalCheckDurationMs += Date.now() - startedAt;
                    if (applicable) {
                        eligibleOperators.push(operator.constructor.name);
                        eligibleCategories.add(entry.runtimeCategory);
                        coverage.applicableCount += 1;
                    } else {
                        coverage.notApplicableCount += 1;
                    }
                } catch {
                    coverage.totalCheckDurationMs += Date.now() - startedAt;
                    coverage.notApplicableCount += 1;
                }
            }

            const target: ReachableTarget = {
                applicationId: this.appName,
                corpusId: this.corpusId,
                scenarioId: context.scenarioId,
                scenarioCategory: context.scenarioCategory,
                sourceSpec: context.sourceSpec,
                viewContext: context.viewContext,
                logicalKey: context.logicalKey ?? null,
                url,
                selector: discovered.selector,
                fingerprint: discovered.fingerprint,
                oracleProtected,
                eligible: !oracleProtected && eligibleOperators.length > 0,
                exclusionReason: eligibleOperators.length === 0
                    ? oracleProtected
                        ? 'oracle-protected'
                        : 'no-applicable-operators'
                    : null,
                eligibleOperators,
                eligibleCategories: [...eligibleCategories].sort(),
                touchpointLogicalKeys: [],
                relevanceBand: 'generic',
                familyStressHints: { semantic: false, css: false, xpath: false },
                relevanceScore: 0,
            };

            target.eligible = eligibleOperators.length > 0;
            if (protectionKind === 'direct-anchor' && eligibleOperators.length > 0) {
                target.exclusionReason = null;
            }

            if (annotation) {
                target.touchpointLogicalKeys = annotation.touchpointLogicalKeys;
                target.relevanceBand = annotation.relevanceBand;
                target.familyStressHints = annotation.familyStressHints;
                target.relevanceScore = annotation.relevanceScore;
            }

            const key = this.buildTargetRegistryKey(target);
            if (!this.targetRegistry.has(key)) {
                this.targetRegistry.set(key, target);
            }
        }

        return Array.from(this.targetRegistry.values());
    }

    async constructScenarios(targets: ReachableTarget[]): Promise<MutationCandidate[]> {
        const candidates: MutationCandidate[] = [];
        const candidateKeys = new Set<string>();
        const operatorCatalog = getBenchmarkOperatorCatalog();

        for (const target of targets) {
            if (!target.eligible) {
                continue;
            }

            for (const operatorName of target.eligibleOperators) {
                const operator = OperatorRegistry.createOperator(operatorName);
                const operatorCoverage = this.operatorCoverage.get(operatorName);
                const operatorEntry = operatorCatalog.find(entry => entry.type === operatorName);
                const runtimeCategory = operatorEntry?.runtimeCategory ?? operator.category;
                const thesisCategory = operatorEntry?.thesisCategory ?? operator.category;
                const candidate = new MutationCandidate(target.selector, operator, target.url, target.fingerprint, {
                    applicationId: target.applicationId,
                    corpusId: target.corpusId,
                    candidateId: this.buildCandidateId(target, operator),
                    scenarioId: target.scenarioId,
                    scenarioCategory: target.scenarioCategory,
                    sourceSpec: target.sourceSpec,
                    viewContext: target.viewContext,
                    logicalKey: target.logicalKey ?? null,
                    oracleProtected: target.oracleProtected,
                    eligible: target.eligible,
                    exclusionReason: target.exclusionReason,
                    eligibleOperators: target.eligibleOperators,
                    eligibleCategories: target.eligibleCategories,
                    quotaBucket: runtimeCategory,
                    aggregateComparisonEligible: true,
                    comparisonExclusionReason: null,
                    operatorCandidateCount: operatorCoverage?.candidateCount,
                    operatorApplicableCount: operatorCoverage?.applicableCount,
                    operatorSkippedOracleCount: operatorCoverage?.skippedOracleCount,
                    operatorNotApplicableCount: operatorCoverage?.notApplicableCount,
                    operatorTotalCheckDurationMs: operatorCoverage?.totalCheckDurationMs,
                    operatorRuntimeCategory: runtimeCategory,
                    operatorThesisCategory: thesisCategory,
                    touchpointLogicalKeys: target.touchpointLogicalKeys,
                    relevanceBand: target.relevanceBand,
                    familyStressHints: target.familyStressHints,
                    relevanceScore: target.relevanceScore,
                    categoryAvailabilityHint: categoryAvailabilityHint(runtimeCategory, {
                        touchpointLogicalKeys: target.touchpointLogicalKeys,
                        relevanceBand: target.relevanceBand,
                        familyStressHints: target.familyStressHints,
                        relevanceScore: target.relevanceScore,
                        tagType: target.fingerprint.tagType,
                        role: target.fingerprint.role,
                    }),
                });

                if (!candidateKeys.has(candidate.candidateId!)) {
                    candidateKeys.add(candidate.candidateId!);
                    candidates.push(candidate);
                }
            }
        }

        return candidates;
    }

    async constructScenariosFromRegistry(): Promise<MutationCandidate[]> {
        const targets = Array.from(this.targetRegistry.values());
        return this.constructScenarios(targets);
    }

    saveScenarios(filePath: string, candidates: MutationCandidate[]) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const payload: SavedScenarioSet = {
            metadata: this.lastSamplingSummary ?? {
                applicationId: this.appName,
                corpusId: this.corpusId,
                generatedAt: new Date().toISOString(),
                totalCandidates: candidates.length,
                totalEligibleCandidates: candidates.length,
                budget: candidates.length,
                seed: 0,
                categoryQuotas: {},
                selectedCounts: {},
                activeScenarioIds: [...new Set(candidates.map(candidate => candidate.scenarioId).filter(Boolean) as string[])].sort(),
            },
            scenarios: candidates.map(candidate => candidate.toJSON()),
        };

        fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
    }

    loadScenarios(filePath: string): MutationCandidate[] {
        if (!fs.existsSync(filePath)) return [];
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const data = Array.isArray(raw) ? raw : raw.scenarios;
        return data.map((d: any) => {
            const operator = OperatorRegistry.createOperator(d.operator.type, d.operator.params);
            const candidate = new MutationCandidate(d.selector, operator, d.url, d.fingerprint, {
                applicationId: d.applicationId,
                corpusId: d.corpusId,
                candidateId: d.candidateId,
                scenarioId: d.scenarioId,
                scenarioCategory: d.scenarioCategory,
                sourceSpec: d.sourceSpec,
                viewContext: d.viewContext,
                logicalKey: d.logicalKey ?? null,
                oracleProtected: d.oracleProtected,
                eligible: d.eligible,
                exclusionReason: d.exclusionReason,
                eligibleOperators: d.eligibleOperators,
                eligibleCategories: d.eligibleCategories,
                quotaBucket: d.quotaBucket,
                selectionSeed: d.selectionSeed,
                aggregateComparisonEligible: d.aggregateComparisonEligible,
                comparisonExclusionReason: d.comparisonExclusionReason,
                operatorCandidateCount: d.operatorCandidateCount,
                operatorApplicableCount: d.operatorApplicableCount,
                operatorSkippedOracleCount: d.operatorSkippedOracleCount,
                operatorNotApplicableCount: d.operatorNotApplicableCount,
                operatorTotalCheckDurationMs: d.operatorTotalCheckDurationMs,
                operatorSelectedCount: d.operatorSelectedCount,
                operatorSelectedApplicableRatio: d.operatorSelectedApplicableRatio,
                operatorRuntimeCategory: d.operatorRuntimeCategory ?? null,
                operatorThesisCategory: d.operatorThesisCategory ?? null,
                touchpointLogicalKeys: d.touchpointLogicalKeys ?? [],
                relevanceBand: d.relevanceBand ?? 'generic',
                familyStressHints: d.familyStressHints ?? { semantic: false, css: false, xpath: false },
                relevanceScore: d.relevanceScore ?? 0,
                categoryAvailabilityHint: d.categoryAvailabilityHint ?? false,
                selectedForCategoryMinimum: d.selectedForCategoryMinimum ?? false,
                selectedForSemanticScenarioCoverage: d.selectedForSemanticScenarioCoverage ?? false,
            });
            if (d.record) candidate.record = d.record;
            return candidate;
        });
    }

    sampleScenarios(candidates: MutationCandidate[], budget: number, seed: number): MutationCandidate[] {
        const requiredSemanticScenarioIds =
            this.corpusId === REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID
                ? getSemanticSupplementScenarioEntriesForApp(this.appName as any).map(entry => entry.scenarioId)
                : [];
        const { selected: finalSelection, summary } =
            this.corpusId === REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID
                ? sampleSemanticSupplementMutationCandidates(candidates, budget, seed, requiredSemanticScenarioIds)
                : sampleMutationCandidates(candidates, budget, seed);
        const eligibleCandidates = candidates.filter(candidate => candidate.eligible !== false && candidate.aggregateComparisonEligible !== false);
        for (const candidate of finalSelection) {
            candidate.quotaBucket = getCandidateCategory(candidate);
            const operatorName = candidate.operator.constructor.name;
            candidate.operatorSelectedCount = summary.selectedCountsByOperator[operatorName] ?? 0;
            candidate.operatorSelectedApplicableRatio = summary.selectedApplicableRatiosByOperator[operatorName] ?? 0;
        }
        const heavilyBlockedByOracleOperators = this.getOperatorCoverageRows()
            .filter(row => row.candidateCount > 0 && row.skippedOracleCount / row.candidateCount >= 0.5)
            .map(row => row.operator)
            .sort();
        this.lastSamplingSummary = {
            applicationId: this.appName,
            corpusId: this.corpusId,
            generatedAt: new Date().toISOString(),
            totalCandidates: candidates.length,
            totalEligibleCandidates: eligibleCandidates.length,
            budget,
            seed,
            categoryQuotas: summary.categoryQuotas,
            selectedCounts: summary.selectedCounts,
            availableCountsByCategory: summary.availableCountsByCategory,
            availableCountsByOperator: summary.availableCountsByOperator,
            selectedCountsByOperator: summary.selectedCountsByOperator,
            selectedApplicableRatiosByOperator: summary.selectedApplicableRatiosByOperator,
            applicableButUnselectedOperators: summary.applicableButUnselectedOperators,
            heavilyBlockedByOracleOperators,
            mandatoryCoverageSatisfied: summary.mandatoryCoverageSatisfied,
            semanticScenarioCoverage: summary.semanticScenarioCoverage,
            semanticScenarioCoverageSatisfied: summary.semanticScenarioCoverageSatisfied,
            activeScenarioIds: [...new Set(finalSelection.map(candidate => candidate.scenarioId).filter(Boolean) as string[])].sort(),
        };

        return finalSelection;
    }

    buildPreflightPool(candidates: MutationCandidate[], budget: number, seed: number): MutationCandidate[] {
        if (this.corpusId === REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID) {
            return buildSemanticSupplementPreflightPool(candidates, seed);
        }

        return buildMutationPreflightPool(candidates, budget, seed);
    }

    getSamplingSummary(): SavedScenarioSet['metadata'] | null {
        return this.lastSamplingSummary;
    }
}
