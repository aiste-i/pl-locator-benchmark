import { createHash } from 'crypto';
import type { MutationCandidate } from '../../webmutator/MutationCandidate';
import type { DomOperator } from '../../webmutator/operators/dom/DomOperator';
import { countFamilyStressHints } from '../../benchmark/realworld-touchpoints';

export const CATEGORY_ORDER: Array<DomOperator['category']> = [
  'structural',
  'content',
  'accessibility-semantic',
  'visibility',
];

export interface SamplingSummary {
  categoryQuotas: Record<string, number>;
  selectedCounts: Record<string, number>;
  availableCountsByCategory: Record<string, number>;
  availableCountsByOperator: Record<string, number>;
  selectedCountsByOperator: Record<string, number>;
  selectedApplicableRatiosByOperator: Record<string, number>;
  applicableButUnselectedOperators: Record<string, string[]>;
  mandatoryCoverageSatisfied: boolean;
  semanticScenarioCoverage?: SemanticScenarioCoverageRow[];
  semanticScenarioCoverageSatisfied?: boolean;
}

export interface SemanticScenarioCoverageRow {
  scenarioId: string;
  status: 'mutated-covered' | 'baseline-supported-no-valid-mutated-candidate';
  selectedCandidateId: string | null;
  reason: string | null;
}

export function getCandidateCategory(candidate: MutationCandidate): DomOperator['category'] {
  const runtimeCategory = candidate.operatorRuntimeCategory;
  if (
    runtimeCategory === 'structural' ||
    runtimeCategory === 'content' ||
    runtimeCategory === 'accessibility-semantic' ||
    runtimeCategory === 'visibility'
  ) {
    return runtimeCategory;
  }

  const quotaBucket = candidate.quotaBucket;
  if (
    quotaBucket === 'structural' ||
    quotaBucket === 'content' ||
    quotaBucket === 'accessibility-semantic' ||
    quotaBucket === 'visibility'
  ) {
    return quotaBucket;
  }

  return candidate.operator.category;
}

function deterministicRank(seed: number, value: string): string {
  return createHash('sha1').update(`${seed}::${value}`).digest('hex');
}

function operatorSeedRank(seed: number, category: DomOperator['category'], operatorName: string): string {
  return deterministicRank(seed, `${category}::${operatorName}`);
}

export function getEligibleCandidates(candidates: MutationCandidate[]): MutationCandidate[] {
  return candidates.filter(candidate => candidate.eligible !== false && candidate.aggregateComparisonEligible !== false);
}

export function computeCategoryQuotas(budget: number): Record<string, number> {
  const baseQuota = Math.floor(budget / CATEGORY_ORDER.length);
  const remainder = budget % CATEGORY_ORDER.length;

  return Object.fromEntries(
    CATEGORY_ORDER.map((category, index) => [category, baseQuota + (index < remainder ? 1 : 0)]),
  ) as Record<string, number>;
}

function getAvailableCountsByCategory(candidates: MutationCandidate[]): Record<string, number> {
  return Object.fromEntries(
    CATEGORY_ORDER.map(category => [
      category,
      candidates.filter(candidate => getCandidateCategory(candidate) === category).length,
    ]),
  ) as Record<string, number>;
}

function getAvailableCountsByOperator(candidates: MutationCandidate[]): Record<string, number> {
  return candidates.reduce((acc, candidate) => {
    const operatorName = candidate.operator.constructor.name;
    acc[operatorName] = (acc[operatorName] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function rankCandidateBase(seed: number, candidate: MutationCandidate): [number, number, string] {
  return [
    candidate.relevanceScore ?? 0,
    countFamilyStressHints(candidate.familyStressHints),
    deterministicRank(seed, candidate.candidateId || candidate.selector),
  ];
}

function compareBaseRanking(seed: number, left: MutationCandidate, right: MutationCandidate): number {
  const [leftRelevance, leftStress, leftHash] = rankCandidateBase(seed, left);
  const [rightRelevance, rightStress, rightHash] = rankCandidateBase(seed, right);

  return (
    rightRelevance - leftRelevance ||
    rightStress - leftStress ||
    leftHash.localeCompare(rightHash)
  );
}

function candidateSelectionComparator(
  seed: number,
  selectedScenarioCounts: Map<string, number>,
  selectedOperatorCounts: Map<string, number>,
) {
  return (left: MutationCandidate, right: MutationCandidate): number => {
    const base = compareBaseRanking(seed, left, right);
    if (base !== 0) {
      return base;
    }

    const leftScenarioCount = selectedScenarioCounts.get(left.scenarioId || '') ?? 0;
    const rightScenarioCount = selectedScenarioCounts.get(right.scenarioId || '') ?? 0;
    if (leftScenarioCount !== rightScenarioCount) {
      return leftScenarioCount - rightScenarioCount;
    }

    const leftOperatorCount = selectedOperatorCounts.get(left.operator.constructor.name) ?? 0;
    const rightOperatorCount = selectedOperatorCounts.get(right.operator.constructor.name) ?? 0;
    if (leftOperatorCount !== rightOperatorCount) {
      return leftOperatorCount - rightOperatorCount;
    }

    return deterministicRank(seed, left.candidateId || left.selector).localeCompare(
      deterministicRank(seed, right.candidateId || right.selector),
    );
  };
}

export function buildCategoryPools(candidates: MutationCandidate[], seed: number): Map<DomOperator['category'], MutationCandidate[]> {
  const eligibleCandidates = getEligibleCandidates(candidates);
  const pools = new Map<DomOperator['category'], MutationCandidate[]>();

  for (const category of CATEGORY_ORDER) {
    pools.set(
      category,
      eligibleCandidates
        .filter(candidate => getCandidateCategory(candidate) === category)
        .sort((left, right) => compareBaseRanking(seed, left, right)),
    );
  }

  return pools;
}

function buildCategoryOperatorPools(
  candidates: MutationCandidate[],
  seed: number,
): Map<DomOperator['category'], Map<string, MutationCandidate[]>> {
  const eligibleCandidates = getEligibleCandidates(candidates);
  const categoryPools = new Map<DomOperator['category'], Map<string, MutationCandidate[]>>();

  for (const category of CATEGORY_ORDER) {
    const operatorPools = new Map<string, MutationCandidate[]>();
    for (const candidate of eligibleCandidates.filter(item => getCandidateCategory(item) === category)) {
      const operatorName = candidate.operator.constructor.name;
      const pool = operatorPools.get(operatorName) ?? [];
      pool.push(candidate);
      operatorPools.set(operatorName, pool);
    }
    for (const [operatorName, pool] of operatorPools.entries()) {
      operatorPools.set(operatorName, pool.sort((left, right) => compareBaseRanking(seed, left, right)));
    }
    categoryPools.set(category, operatorPools);
  }

  return categoryPools;
}

function markSelection(candidate: MutationCandidate, seed: number, selectedForCategoryMinimum: boolean): MutationCandidate {
  candidate.selectionSeed = seed;
  candidate.quotaBucket = getCandidateCategory(candidate);
  candidate.selectedForCategoryMinimum = selectedForCategoryMinimum;
  return candidate;
}

function pickCandidateFromPool(
  pool: MutationCandidate[],
  used: Set<string>,
  seed: number,
  selectedScenarioCounts: Map<string, number>,
  selectedOperatorCounts: Map<string, number>,
  preferAvailabilityHint: boolean,
): MutationCandidate | null {
  const availablePool = pool.filter(candidate => !used.has(candidate.candidateId || candidate.selector));
  if (availablePool.length === 0) {
    return null;
  }

  const preferredPool = preferAvailabilityHint
    ? availablePool.filter(candidate => candidate.categoryAvailabilityHint !== false)
    : availablePool;

  const selectionPool = preferredPool.length > 0 ? preferredPool : availablePool;
  selectionPool.sort(candidateSelectionComparator(seed, selectedScenarioCounts, selectedOperatorCounts));
  return selectionPool[0] ?? null;
}

function registerSelection(
  candidate: MutationCandidate,
  selectedScenarioCounts: Map<string, number>,
  selectedOperatorCounts: Map<string, number>,
  used: Set<string>,
) {
  used.add(candidate.candidateId || candidate.selector);
  selectedScenarioCounts.set(candidate.scenarioId || '', (selectedScenarioCounts.get(candidate.scenarioId || '') ?? 0) + 1);
  selectedOperatorCounts.set(candidate.operator.constructor.name, (selectedOperatorCounts.get(candidate.operator.constructor.name) ?? 0) + 1);
}

function selectOperatorByLowestRatio(
  seed: number,
  category: DomOperator['category'],
  operatorPools: Map<string, MutationCandidate[]>,
  availableCountsByOperator: Record<string, number>,
  selectedOperatorCounts: Map<string, number>,
  used: Set<string>,
): string | null {
  const availableOperators = [...operatorPools.entries()]
    .filter(([, pool]) => pool.some(candidate => !used.has(candidate.candidateId || candidate.selector)))
    .map(([operatorName]) => operatorName);

  if (availableOperators.length === 0) {
    return null;
  }

  availableOperators.sort((left, right) => {
    const leftSelected = selectedOperatorCounts.get(left) ?? 0;
    const rightSelected = selectedOperatorCounts.get(right) ?? 0;
    const leftAvailable = availableCountsByOperator[left] ?? 1;
    const rightAvailable = availableCountsByOperator[right] ?? 1;
    const leftRatio = leftSelected / leftAvailable;
    const rightRatio = rightSelected / rightAvailable;

    return (
      leftRatio - rightRatio ||
      leftSelected - rightSelected ||
      operatorSeedRank(seed, category, left).localeCompare(operatorSeedRank(seed, category, right))
    );
  });

  return availableOperators[0] ?? null;
}

function summarizeSelectedOperators(
  availableCountsByOperator: Record<string, number>,
  selectedOperatorCounts: Map<string, number>,
): {
  selectedCountsByOperator: Record<string, number>;
  selectedApplicableRatiosByOperator: Record<string, number>;
} {
  const selectedCountsByOperator = Object.fromEntries(
    Object.keys(availableCountsByOperator)
      .sort()
      .map(operatorName => [operatorName, selectedOperatorCounts.get(operatorName) ?? 0]),
  ) as Record<string, number>;

  const selectedApplicableRatiosByOperator = Object.fromEntries(
    Object.entries(availableCountsByOperator)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([operatorName, availableCount]) => [
        operatorName,
        availableCount > 0 ? (selectedCountsByOperator[operatorName] ?? 0) / availableCount : 0,
      ]),
  ) as Record<string, number>;

  return {
    selectedCountsByOperator,
    selectedApplicableRatiosByOperator,
  };
}

function scenarioCoverageComparator(seed: number) {
  return (left: MutationCandidate, right: MutationCandidate): number => {
    const leftHint = left.categoryAvailabilityHint === false ? 0 : 1;
    const rightHint = right.categoryAvailabilityHint === false ? 0 : 1;

    return (
      rightHint - leftHint ||
      compareBaseRanking(seed, left, right) ||
      String(left.candidateId || left.selector).localeCompare(String(right.candidateId || right.selector))
    );
  };
}

function selectSemanticScenarioCoverageCandidates(
  candidates: MutationCandidate[],
  seed: number,
  requiredScenarioIds: string[],
): { selected: MutationCandidate[]; coverage: SemanticScenarioCoverageRow[] } {
  const eligibleCandidates = getEligibleCandidates(candidates);
  const selected: MutationCandidate[] = [];
  const coverage: SemanticScenarioCoverageRow[] = [];
  const used = new Set<string>();

  for (const scenarioId of [...requiredScenarioIds].sort()) {
    const pool = eligibleCandidates
      .filter(candidate => candidate.scenarioId === scenarioId)
      .filter(candidate => !used.has(candidate.candidateId || candidate.selector))
      .sort(scenarioCoverageComparator(seed));

    const candidate = pool[0] ?? null;
    if (!candidate) {
      coverage.push({
        scenarioId,
        status: 'baseline-supported-no-valid-mutated-candidate',
        selectedCandidateId: null,
        reason: 'no eligible validated mutation candidate for supported supplement scenario',
      });
      continue;
    }

    candidate.selectedForSemanticScenarioCoverage = true;
    selected.push(markSelection(candidate, seed, false));
    used.add(candidate.candidateId || candidate.selector);
    coverage.push({
      scenarioId,
      status: 'mutated-covered',
      selectedCandidateId: candidate.candidateId ?? candidate.selector,
      reason: null,
    });
  }

  return { selected, coverage };
}

function countSelectedByCategory(selected: MutationCandidate[]): Record<string, number> {
  return selected.reduce((acc, candidate) => {
    const category = getCandidateCategory(candidate);
    acc[category] = (acc[category] ?? 0) + 1;
    return acc;
  }, Object.fromEntries(CATEGORY_ORDER.map(category => [category, 0])) as Record<string, number>);
}

function countSelectedByOperator(selected: MutationCandidate[]): Map<string, number> {
  return selected.reduce((acc, candidate) => {
    const operatorName = candidate.operator.constructor.name;
    acc.set(operatorName, (acc.get(operatorName) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());
}

export function sampleMutationCandidates(
  candidates: MutationCandidate[],
  budget: number,
  seed: number,
): { selected: MutationCandidate[]; summary: SamplingSummary } {
  const eligibleCandidates = getEligibleCandidates(candidates);
  const categoryQuotas = computeCategoryQuotas(budget);
  const availableCountsByCategory = getAvailableCountsByCategory(eligibleCandidates);
  const availableCountsByOperator = getAvailableCountsByOperator(eligibleCandidates);
  const operatorPoolsByCategory = buildCategoryOperatorPools(candidates, seed);
  const selected: MutationCandidate[] = [];
  const selectedCounts = Object.fromEntries(CATEGORY_ORDER.map(category => [category, 0])) as Record<string, number>;
  const requireMandatoryCoverage = budget >= CATEGORY_ORDER.length;
  const selectedScenarioCounts = new Map<string, number>();
  const selectedOperatorCounts = new Map<string, number>();
  const used = new Set<string>();

  for (const category of CATEGORY_ORDER) {
    const quota = categoryQuotas[category];
    const operatorPools = operatorPoolsByCategory.get(category) ?? new Map<string, MutationCandidate[]>();
    const operatorOrder = [...operatorPools.keys()].sort((left, right) =>
      operatorSeedRank(seed, category, left).localeCompare(operatorSeedRank(seed, category, right)),
    );

    for (const operatorName of operatorOrder) {
      if (selectedCounts[category] >= quota || selected.length >= budget) {
        break;
      }

      const candidate = pickCandidateFromPool(
        operatorPools.get(operatorName) ?? [],
        used,
        seed,
        selectedScenarioCounts,
        selectedOperatorCounts,
        true,
      );
      if (!candidate) {
        continue;
      }

      selected.push(markSelection(candidate, seed, true));
      selectedCounts[category] += 1;
      registerSelection(candidate, selectedScenarioCounts, selectedOperatorCounts, used);
    }

    while (selectedCounts[category] < quota && selected.length < budget) {
      const operatorName = selectOperatorByLowestRatio(
        seed,
        category,
        operatorPools,
        availableCountsByOperator,
        selectedOperatorCounts,
        used,
      );
      if (!operatorName) {
        break;
      }

      const candidate = pickCandidateFromPool(
        operatorPools.get(operatorName) ?? [],
        used,
        seed,
        selectedScenarioCounts,
        selectedOperatorCounts,
        false,
      );
      if (!candidate) {
        break;
      }

      selected.push(markSelection(candidate, seed, false));
      selectedCounts[category] += 1;
      registerSelection(candidate, selectedScenarioCounts, selectedOperatorCounts, used);
    }
  }

  while (selected.length < budget) {
    const remaining = eligibleCandidates.filter(candidate => !used.has(candidate.candidateId || candidate.selector));
    if (remaining.length === 0) {
      break;
    }
    remaining.sort(candidateSelectionComparator(seed, selectedScenarioCounts, selectedOperatorCounts));
    const candidate = remaining[0];
    selected.push(markSelection(candidate, seed, false));
    selectedCounts[getCandidateCategory(candidate)] += 1;
    registerSelection(candidate, selectedScenarioCounts, selectedOperatorCounts, used);
  }

  const { selectedCountsByOperator, selectedApplicableRatiosByOperator } = summarizeSelectedOperators(
    availableCountsByOperator,
    selectedOperatorCounts,
  );

  const applicableButUnselectedOperators = Object.fromEntries(
    CATEGORY_ORDER.map(category => {
      const operatorPools = operatorPoolsByCategory.get(category) ?? new Map<string, MutationCandidate[]>();
      const operators = [...operatorPools.keys()]
        .filter(operatorName => (availableCountsByOperator[operatorName] ?? 0) > 0 && (selectedCountsByOperator[operatorName] ?? 0) === 0)
        .sort((left, right) => left.localeCompare(right));
      return [category, operators];
    }),
  ) as Record<string, string[]>;

  const mandatoryCoverageSatisfied =
    !requireMandatoryCoverage ||
    CATEGORY_ORDER.every(category => availableCountsByCategory[category] === 0 || selectedCounts[category] > 0);

  return {
    selected: selected.slice(0, budget),
    summary: {
      categoryQuotas,
      selectedCounts,
      availableCountsByCategory,
      availableCountsByOperator,
      selectedCountsByOperator,
      selectedApplicableRatiosByOperator,
      applicableButUnselectedOperators,
      mandatoryCoverageSatisfied,
    },
  };
}

export function sampleSemanticSupplementMutationCandidates(
  candidates: MutationCandidate[],
  budget: number,
  seed: number,
  requiredScenarioIds: string[],
): { selected: MutationCandidate[]; summary: SamplingSummary } {
  const eligibleCandidates = getEligibleCandidates(candidates);
  const effectiveBudget = Math.max(budget, requiredScenarioIds.length);
  const coverageSelection = selectSemanticScenarioCoverageCandidates(candidates, seed, requiredScenarioIds);
  const stageZeroIds = new Set(coverageSelection.selected.map(candidate => candidate.candidateId || candidate.selector));
  const remainingBudget = Math.max(0, effectiveBudget - coverageSelection.selected.length);
  const normalSelection = sampleMutationCandidates(
    eligibleCandidates.filter(candidate => !stageZeroIds.has(candidate.candidateId || candidate.selector)),
    remainingBudget,
    seed,
  );
  const selected = [...coverageSelection.selected, ...normalSelection.selected].slice(0, effectiveBudget);
  const selectedOperatorCounts = countSelectedByOperator(selected);
  const selectedCounts = countSelectedByCategory(selected);
  const availableCountsByCategory = getAvailableCountsByCategory(eligibleCandidates);
  const availableCountsByOperator = getAvailableCountsByOperator(eligibleCandidates);
  const { selectedCountsByOperator, selectedApplicableRatiosByOperator } = summarizeSelectedOperators(
    availableCountsByOperator,
    selectedOperatorCounts,
  );
  const operatorPoolsByCategory = buildCategoryOperatorPools(candidates, seed);
  const applicableButUnselectedOperators = Object.fromEntries(
    CATEGORY_ORDER.map(category => {
      const operatorPools = operatorPoolsByCategory.get(category) ?? new Map<string, MutationCandidate[]>();
      const operators = [...operatorPools.keys()]
        .filter(operatorName => (availableCountsByOperator[operatorName] ?? 0) > 0 && (selectedCountsByOperator[operatorName] ?? 0) === 0)
        .sort((left, right) => left.localeCompare(right));
      return [category, operators];
    }),
  ) as Record<string, string[]>;

  for (const candidate of selected) {
    candidate.selectionSeed = seed;
    candidate.quotaBucket = getCandidateCategory(candidate);
  }

  return {
    selected,
    summary: {
      categoryQuotas: computeCategoryQuotas(effectiveBudget),
      selectedCounts,
      availableCountsByCategory,
      availableCountsByOperator,
      selectedCountsByOperator,
      selectedApplicableRatiosByOperator,
      applicableButUnselectedOperators,
      mandatoryCoverageSatisfied: true,
      semanticScenarioCoverage: coverageSelection.coverage,
      semanticScenarioCoverageSatisfied: coverageSelection.coverage.every(row => row.status === 'mutated-covered'),
    },
  };
}

export function buildSemanticSupplementPreflightPool(candidates: MutationCandidate[], seed: number): MutationCandidate[] {
  return getEligibleCandidates(candidates)
    .sort((left, right) =>
      String(left.scenarioId ?? '').localeCompare(String(right.scenarioId ?? '')) ||
      scenarioCoverageComparator(seed)(left, right),
    );
}

function buildPreflightCategorySelection(
  category: DomOperator['category'],
  operatorPools: Map<string, MutationCandidate[]>,
  categoryQuota: number,
  seed: number,
): MutationCandidate[] {
  const selected = new Map<string, MutationCandidate>();
  const applicableCounts = Object.fromEntries(
    [...operatorPools.entries()].map(([operatorName, pool]) => [operatorName, pool.length]),
  ) as Record<string, number>;
  const selectedOperatorCounts = new Map<string, number>();
  const selectedScenarioCounts = new Map<string, number>();
  const used = new Set<string>();
  const operatorOrder = [...operatorPools.keys()].sort((left, right) =>
    operatorSeedRank(seed, category, left).localeCompare(operatorSeedRank(seed, category, right)),
  );
  const targetCount = Math.min(
    [...operatorPools.values()].reduce((sum, pool) => sum + pool.length, 0),
    categoryQuota + operatorOrder.length,
  );

  for (const operatorName of operatorOrder) {
    const candidate = pickCandidateFromPool(
      operatorPools.get(operatorName) ?? [],
      used,
      seed,
      selectedScenarioCounts,
      selectedOperatorCounts,
      true,
    );
    if (!candidate) {
      continue;
    }
    selected.set(candidate.candidateId || candidate.selector, candidate);
    registerSelection(candidate, selectedScenarioCounts, selectedOperatorCounts, used);
  }

  while (selected.size < targetCount) {
    const operatorName = selectOperatorByLowestRatio(
      seed,
      category,
      operatorPools,
      applicableCounts,
      selectedOperatorCounts,
      used,
    );
    if (!operatorName) {
      break;
    }

    const candidate = pickCandidateFromPool(
      operatorPools.get(operatorName) ?? [],
      used,
      seed,
      selectedScenarioCounts,
      selectedOperatorCounts,
      false,
    );
    if (!candidate) {
      break;
    }

    selected.set(candidate.candidateId || candidate.selector, candidate);
    registerSelection(candidate, selectedScenarioCounts, selectedOperatorCounts, used);
  }

  return [...selected.values()];
}

export function buildMutationPreflightPool(
  candidates: MutationCandidate[],
  budget: number,
  seed: number,
): MutationCandidate[] {
  const categoryQuotas = computeCategoryQuotas(budget);
  const operatorPoolsByCategory = buildCategoryOperatorPools(candidates, seed);
  const categoryPools = buildCategoryPools(candidates, seed);
  const selected = new Map<string, MutationCandidate>();

  for (const category of CATEGORY_ORDER) {
    const categorySelection = buildPreflightCategorySelection(
      category,
      operatorPoolsByCategory.get(category) ?? new Map<string, MutationCandidate[]>(),
      categoryQuotas[category],
      seed,
    );
    for (const candidate of categorySelection) {
      if (candidate.candidateId) {
        selected.set(candidate.candidateId, candidate);
      }
    }
  }

  return CATEGORY_ORDER.flatMap(category =>
    (categoryPools.get(category) ?? []).filter(
      candidate => candidate.candidateId && selected.has(candidate.candidateId),
    ),
  );
}
