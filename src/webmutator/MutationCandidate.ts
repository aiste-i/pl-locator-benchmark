import { MutationRecord } from './MutationRecord';
import { DomOperator } from './operators/dom/DomOperator';
import type { FamilyStressHints, RelevanceBand } from '../benchmark/realworld-touchpoints';

export interface MutationCandidateMetadata {
    applicationId?: string;
    corpusId?: string;
    candidateId?: string;
    scenarioId?: string;
    scenarioCategory?: string;
    sourceSpec?: string;
    viewContext?: string;
    logicalKey?: string | null;
    oracleProtected?: boolean;
    eligible?: boolean;
    exclusionReason?: string | null;
    eligibleOperators?: string[];
    eligibleCategories?: string[];
    quotaBucket?: string;
    selectionSeed?: number;
    aggregateComparisonEligible?: boolean;
    comparisonExclusionReason?: string | null;
    operatorCandidateCount?: number;
    operatorApplicableCount?: number;
    operatorSkippedOracleCount?: number;
    operatorNotApplicableCount?: number;
    operatorTotalCheckDurationMs?: number;
    operatorSelectedCount?: number;
    operatorSelectedApplicableRatio?: number;
    operatorRuntimeCategory?: string | null;
    operatorThesisCategory?: string | null;
    touchpointLogicalKeys?: string[];
    relevanceBand?: RelevanceBand;
    familyStressHints?: FamilyStressHints;
    relevanceScore?: number;
    categoryAvailabilityHint?: boolean;
    selectedForCategoryMinimum?: boolean;
    selectedForSemanticScenarioCoverage?: boolean;
}

export class MutationCandidate {
    selector: string;
    operator: DomOperator;
    record?: MutationRecord;
    url?: string;
    fingerprint?: any;
    applicationId?: string;
    corpusId?: string;
    candidateId?: string;
    scenarioId?: string;
    scenarioCategory?: string;
    sourceSpec?: string;
    viewContext?: string;
    logicalKey?: string | null;
    oracleProtected?: boolean;
    eligible?: boolean;
    exclusionReason?: string | null;
    eligibleOperators?: string[];
    eligibleCategories?: string[];
    quotaBucket?: string;
    selectionSeed?: number;
    aggregateComparisonEligible?: boolean;
    comparisonExclusionReason?: string | null;
    operatorCandidateCount?: number;
    operatorApplicableCount?: number;
    operatorSkippedOracleCount?: number;
    operatorNotApplicableCount?: number;
    operatorTotalCheckDurationMs?: number;
    operatorSelectedCount?: number;
    operatorSelectedApplicableRatio?: number;
    operatorRuntimeCategory?: string | null;
    operatorThesisCategory?: string | null;
    touchpointLogicalKeys?: string[];
    relevanceBand?: RelevanceBand;
    familyStressHints?: FamilyStressHints;
    relevanceScore?: number;
    categoryAvailabilityHint?: boolean;
    selectedForCategoryMinimum?: boolean;
    selectedForSemanticScenarioCoverage?: boolean;

    constructor(selector: string, operator: DomOperator, url?: string, fingerprint?: any, metadata: MutationCandidateMetadata = {}) {
        this.selector = selector;
        this.operator = operator;
        this.url = url;
        this.fingerprint = fingerprint;
        Object.assign(this, metadata);
    }

    toJSON() {
        return {
            applicationId: this.applicationId,
            corpusId: this.corpusId,
            candidateId: this.candidateId,
            scenarioId: this.scenarioId,
            scenarioCategory: this.scenarioCategory,
            sourceSpec: this.sourceSpec,
            viewContext: this.viewContext,
            logicalKey: this.logicalKey ?? null,
            selector: this.selector,
            operator: {
                ...this.operator.serialize(),
                category: this.operator.category
            },
            url: this.url,
            fingerprint: this.fingerprint,
            oracleProtected: this.oracleProtected ?? false,
            eligible: this.eligible ?? true,
            exclusionReason: this.exclusionReason ?? null,
            eligibleOperators: this.eligibleOperators ?? [],
            eligibleCategories: this.eligibleCategories ?? [],
            quotaBucket: this.quotaBucket ?? this.operator.category,
            selectionSeed: this.selectionSeed ?? null,
            aggregateComparisonEligible: this.aggregateComparisonEligible ?? true,
            comparisonExclusionReason: this.comparisonExclusionReason ?? null,
            operatorCandidateCount: this.operatorCandidateCount ?? null,
            operatorApplicableCount: this.operatorApplicableCount ?? null,
            operatorSkippedOracleCount: this.operatorSkippedOracleCount ?? null,
            operatorNotApplicableCount: this.operatorNotApplicableCount ?? null,
            operatorTotalCheckDurationMs: this.operatorTotalCheckDurationMs ?? null,
            operatorSelectedCount: this.operatorSelectedCount ?? null,
            operatorSelectedApplicableRatio: this.operatorSelectedApplicableRatio ?? null,
            operatorRuntimeCategory: this.operatorRuntimeCategory ?? null,
            operatorThesisCategory: this.operatorThesisCategory ?? null,
            touchpointLogicalKeys: this.touchpointLogicalKeys ?? [],
            relevanceBand: this.relevanceBand ?? 'generic',
            familyStressHints: this.familyStressHints ?? { semantic: false, css: false, xpath: false },
            relevanceScore: this.relevanceScore ?? 0,
            categoryAvailabilityHint: this.categoryAvailabilityHint ?? false,
            selectedForCategoryMinimum: this.selectedForCategoryMinimum ?? false,
            selectedForSemanticScenarioCoverage: this.selectedForSemanticScenarioCoverage ?? false,
            record: this.record
        };
    }
}
