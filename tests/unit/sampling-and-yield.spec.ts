import { test, expect } from '@playwright/test';
import { MutationCandidate } from '../../src/webmutator/MutationCandidate';
import { TextReplace } from '../../src/webmutator/operators/dom/TextReplace';
import { StyleVisibility } from '../../src/webmutator/operators/dom/StyleVisibility';
import { SubtreeDelete } from '../../src/webmutator/operators/dom/SubtreeDelete';
import { ChangeAriaLabel } from '../../src/webmutator/operators/dom/accessibility/ChangeAriaLabel';
import {
  buildMutationPreflightPool,
  buildSemanticSupplementPreflightPool,
  computeCategoryQuotas,
  sampleMutationCandidates,
  sampleSemanticSupplementMutationCandidates,
} from '../../src/benchmark/runner/sampling';
import { evaluateComparableYield } from '../../src/benchmark/comparable-yield';
import { evaluateMutationMeaningfulness } from '../../src/benchmark/mutation-quality';
import { ReplaceHeadingWithP } from '../../src/webmutator/operators/dom/accessibility/ReplaceHeadingWithP';
import { annotateTargetRelevance, type ScenarioTouchpoint } from '../../src/benchmark/realworld-touchpoints';

function candidatePool(): MutationCandidate[] {
  const factories = [
    () => new SubtreeDelete(),
    () => new TextReplace('mutated'),
    () => new ChangeAriaLabel(),
    () => new StyleVisibility(),
  ];

  return Array.from({ length: 24 }, (_, index) => {
    const operator = factories[index % factories.length]();
    return new MutationCandidate(`#target-${index}`, operator, 'http://example.test', { tagType: 'div' }, {
      applicationId: 'angular-realworld-example-app',
      candidateId: `candidate-${index.toString().padStart(2, '0')}`,
      scenarioId: `scenario-${index % 4}`,
      viewContext: `view-${index % 2}`,
      eligible: true,
      aggregateComparisonEligible: true,
    });
  });
}

test('preflight pool keeps deterministic operator-diverse coverage per category', () => {
  const candidates = candidatePool();
  const preflightPool = buildMutationPreflightPool(candidates, 10, 12345);

  expect(preflightPool).toHaveLength(14);
  expect(preflightPool.map(candidate => candidate.candidateId)).toEqual(
    buildMutationPreflightPool(candidates, 10, 12345).map(candidate => candidate.candidateId),
  );
});

test('final sampling rebalances across validated candidates only', () => {
  const candidates = candidatePool().filter(candidate => !['candidate-00', 'candidate-01', 'candidate-02'].includes(candidate.candidateId!));
  const sampled = sampleMutationCandidates(candidates, 8, 12345);

  expect(sampled.selected).toHaveLength(8);
  expect(sampled.summary.categoryQuotas).toEqual(computeCategoryQuotas(8));
});

test('semantic supplement sampling adds deterministic per-scenario coverage before normal selection', () => {
  const candidates = candidatePool().map((candidate, index) => {
    candidate.corpusId = 'realworld-semantic-supplement';
    candidate.scenarioId = `semantic.scenario-${index % 3}`;
    return candidate;
  });

  const sampled = sampleSemanticSupplementMutationCandidates(
    candidates,
    2,
    12345,
    ['semantic.scenario-0', 'semantic.scenario-1', 'semantic.scenario-2', 'semantic.scenario-missing'],
  );

  expect(sampled.selected).toHaveLength(4);
  expect(new Set(sampled.selected.map(candidate => candidate.scenarioId))).toEqual(
    new Set(['semantic.scenario-0', 'semantic.scenario-1', 'semantic.scenario-2']),
  );
  expect(sampled.selected.filter(candidate => candidate.selectedForSemanticScenarioCoverage)).toHaveLength(3);
  expect(sampled.summary.semanticScenarioCoverage).toEqual(expect.arrayContaining([
    expect.objectContaining({ scenarioId: 'semantic.scenario-0', status: 'mutated-covered' }),
    expect.objectContaining({ scenarioId: 'semantic.scenario-missing', status: 'baseline-supported-no-valid-mutated-candidate' }),
  ]));
  expect(sampled.summary.semanticScenarioCoverageSatisfied).toBe(false);
  expect(sampleSemanticSupplementMutationCandidates(candidates, 2, 12345, ['semantic.scenario-0']).selected.map(candidate => candidate.candidateId)).toEqual(
    sampleSemanticSupplementMutationCandidates(candidates, 2, 12345, ['semantic.scenario-0']).selected.map(candidate => candidate.candidateId),
  );
});

test('semantic supplement preflight pool includes all eligible candidates so no-valid mutation statuses are explicit', () => {
  const candidates = candidatePool();
  candidates[0].eligible = false;
  candidates[1].aggregateComparisonEligible = false;

  const preflightPool = buildSemanticSupplementPreflightPool(candidates, 12345);

  expect(preflightPool).toHaveLength(candidates.length - 2);
  expect(preflightPool.map(candidate => candidate.candidateId)).toEqual(
    buildSemanticSupplementPreflightPool(candidates, 12345).map(candidate => candidate.candidateId),
  );
});

test('exact touchpoint candidates outrank generic candidates within the same category', () => {
  const exact = new MutationCandidate('#exact', new TextReplace('mutated'), 'http://example.test', { tagType: 'button' }, {
    candidateId: 'exact',
    scenarioId: 'scenario-a',
    eligible: true,
    aggregateComparisonEligible: true,
    relevanceBand: 'exact-touchpoint',
    relevanceScore: 650,
    categoryAvailabilityHint: true,
    touchpointLogicalKeys: ['article.favoriteButton'],
    familyStressHints: { semantic: true, css: true, xpath: true },
  });
  const generic = new MutationCandidate('#generic', new TextReplace('mutated'), 'http://example.test', { tagType: 'p' }, {
    candidateId: 'generic',
    scenarioId: 'scenario-b',
    eligible: true,
    aggregateComparisonEligible: true,
    relevanceBand: 'generic',
    relevanceScore: 0,
    categoryAvailabilityHint: false,
    familyStressHints: { semantic: false, css: false, xpath: false },
  });

  const sampled = sampleMutationCandidates([generic, exact], 1, 12345);

  expect(sampled.selected.map(candidate => candidate.candidateId)).toEqual(['exact']);
});

test('accessible-name surface candidates outrank unrelated generic accessibility-semantic candidates', () => {
  const relevant = new MutationCandidate('#button-label', new ChangeAriaLabel(), 'http://example.test', { tagType: 'button' }, {
    candidateId: 'accessible-relevant',
    scenarioId: 'scenario-a',
    eligible: true,
    aggregateComparisonEligible: true,
    relevanceBand: 'same-accessible-name-surface',
    relevanceScore: 345,
    categoryAvailabilityHint: true,
    touchpointLogicalKeys: ['comments.deleteButton'],
    familyStressHints: { semantic: true, css: true, xpath: true },
  });
  const generic = new MutationCandidate('#paragraph', new ChangeAriaLabel(), 'http://example.test', { tagType: 'div' }, {
    candidateId: 'accessible-generic',
    scenarioId: 'scenario-b',
    eligible: true,
    aggregateComparisonEligible: true,
    relevanceBand: 'generic',
    relevanceScore: 0,
    categoryAvailabilityHint: false,
    familyStressHints: { semantic: false, css: false, xpath: false },
  });

  const sampled = sampleMutationCandidates([generic, relevant], 1, 12345);

  expect(sampled.selected.map(candidate => candidate.candidateId)).toEqual(['accessible-relevant']);
});

test('stable selector aliases preserve exact touchpoint relevance for protected controls', () => {
  const touchpoints: ScenarioTouchpoint[] = [
    {
      logicalKey: 'article.favoriteButton',
      role: 'primary-action',
      priority: 40,
      resolvedTarget: {
        selector: 'app-root > app-article-page > div > div:nth-of-type(1) > div > app-article-meta > div > span > app-favorite-button > button',
        stableSelector: '[data-testid="article-favorite-btn"]',
        tagType: 'button',
        role: '',
        accessibleNameSurfaceSelector: '[data-testid="article-favorite-btn"]',
        actionableContainerSelector: '[data-testid="article-favorite-btn"]',
        collectionItemSelector: null,
      },
      familyMeta: {
        semantic: { logicalKey: 'article.favoriteButton', family: 'semantic-first', selector: 'getByRole(button)' } as any,
        css: { logicalKey: 'article.favoriteButton', family: 'css', selector: '[data-testid="article-favorite-btn"]' } as any,
        xpath: { logicalKey: 'article.favoriteButton', family: 'xpath', selector: '//button[@data-testid="article-favorite-btn"]' } as any,
        oracle: null,
      },
    },
  ];

  const annotation = annotateTargetRelevance(
    {
      selector: '[data-testid="article-favorite-btn"]',
      stableSelector: '[data-testid="article-favorite-btn"]',
      tagType: 'button',
      role: '',
      accessibleNameSurfaceSelector: '[data-testid="article-favorite-btn"]',
      actionableContainerSelector: '[data-testid="article-favorite-btn"]',
      collectionItemSelector: null,
    },
    touchpoints,
  );

  expect(annotation.relevanceBand).toBe('exact-touchpoint');
  expect(annotation.relevanceScore).toBeGreaterThan(0);
  expect(annotation.touchpointLogicalKeys).toEqual(['article.favoriteButton']);
});

test('runtime category overrides raw operator category for accessibility-semantic coverage', () => {
  const runtimeAccessibilityCandidate = new MutationCandidate('#heading', new ReplaceHeadingWithP(), 'http://example.test', { tagType: 'h1' }, {
    candidateId: 'runtime-accessibility',
    scenarioId: 'scenario-a',
    eligible: true,
    aggregateComparisonEligible: true,
    operatorRuntimeCategory: 'accessibility-semantic',
    quotaBucket: 'accessibility-semantic',
    relevanceBand: 'exact-touchpoint',
    relevanceScore: 700,
    categoryAvailabilityHint: true,
    familyStressHints: { semantic: true, css: true, xpath: true },
  });
  const structural = new MutationCandidate('#container', new SubtreeDelete(), 'http://example.test', { tagType: 'div' }, {
    candidateId: 'structural',
    scenarioId: 'scenario-b',
    eligible: true,
    aggregateComparisonEligible: true,
  });
  const content = new MutationCandidate('#copy', new TextReplace('mutated'), 'http://example.test', { tagType: 'p' }, {
    candidateId: 'content',
    scenarioId: 'scenario-c',
    eligible: true,
    aggregateComparisonEligible: true,
  });
  const visibility = new MutationCandidate('#visible', new StyleVisibility(), 'http://example.test', { tagType: 'div' }, {
    candidateId: 'visibility',
    scenarioId: 'scenario-d',
    eligible: true,
    aggregateComparisonEligible: true,
  });

  const sampled = sampleMutationCandidates(
    [runtimeAccessibilityCandidate, structural, content, visibility],
    4,
    12345,
  );

  expect(sampled.summary.mandatoryCoverageSatisfied).toBe(true);
  expect(sampled.summary.selectedCounts['accessibility-semantic']).toBe(1);
  expect(sampled.selected.map(candidate => candidate.candidateId)).toContain('runtime-accessibility');
});

test('budget >= 4 still counts mandatory coverage as satisfied when a category has no eligible candidates', () => {
  const candidates = candidatePool().filter(candidate => candidate.operator.category !== 'accessibility-semantic');
  const sampled = sampleMutationCandidates(candidates, 8, 12345);

  expect(sampled.summary.mandatoryCoverageSatisfied).toBe(true);
  expect(sampled.summary.selectedCounts['accessibility-semantic']).toBe(0);
});

test('budget >= 4 keeps at least one candidate from each category when available', () => {
  const sampled = sampleMutationCandidates(candidatePool(), 8, 12345);

  expect(sampled.summary.mandatoryCoverageSatisfied).toBe(true);
  expect(sampled.summary.selectedCounts['structural']).toBeGreaterThan(0);
  expect(sampled.summary.selectedCounts['content']).toBeGreaterThan(0);
  expect(sampled.summary.selectedCounts['accessibility-semantic']).toBeGreaterThan(0);
  expect(sampled.summary.selectedCounts['visibility']).toBeGreaterThan(0);
});

test('meaningfulness checks reject weak generic no-op mutations and accept relevant semantic effects', () => {
  expect(
    evaluateMutationMeaningfulness(
      'content',
      'generic',
      {
        exists: true,
        tagType: 'p',
        textContent: 'before',
        className: null,
        style: null,
        role: null,
        ariaLabel: null,
        ariaLabelledBy: null,
        id: null,
        placeholder: null,
        alt: null,
        title: null,
        htmlFor: null,
        hidden: false,
        childElementCount: 0,
        textNodeCount: 1,
        parentSelector: 'div > p',
      },
      {
        exists: true,
        tagType: 'p',
        textContent: 'before',
        className: null,
        style: null,
        role: null,
        ariaLabel: null,
        ariaLabelledBy: null,
        id: null,
        placeholder: null,
        alt: null,
        title: null,
        htmlFor: null,
        hidden: false,
        childElementCount: 0,
        textNodeCount: 1,
        parentSelector: 'div > p',
      },
    ),
  ).toEqual({
    meaningful: false,
    reason: 'relevance-too-weak',
  });

  expect(
    evaluateMutationMeaningfulness(
      'accessibility-semantic',
      'same-accessible-name-surface',
      {
        exists: true,
        tagType: 'button',
        textContent: 'Delete comment',
        className: null,
        style: null,
        role: 'button',
        ariaLabel: 'Delete comment',
        ariaLabelledBy: null,
        id: null,
        placeholder: null,
        alt: null,
        title: null,
        htmlFor: null,
        hidden: false,
        childElementCount: 1,
        textNodeCount: 1,
        parentSelector: 'div > button',
      },
      {
        exists: true,
        tagType: 'button',
        textContent: 'Delete comment',
        className: null,
        style: null,
        role: 'button',
        ariaLabel: 'Remove comment',
        ariaLabelledBy: null,
        id: null,
        placeholder: null,
        alt: null,
        title: null,
        htmlFor: null,
        hidden: false,
        childElementCount: 1,
        textNodeCount: 1,
        parentSelector: 'div > button',
      },
    ),
  ).toEqual({
    meaningful: true,
    reason: null,
  });
});

test('comparable yield guard flags low-yield browser-family rows', () => {
  const failures = evaluateComparableYield([
    {
      appId: 'realworld',
      browserName: 'chromium',
      family: 'semantic-first',
      mutatedRuns: 10,
      comparableMutatedRuns: 4,
    },
    {
      appId: 'angular-realworld-example-app',
      browserName: 'chromium',
      family: 'css',
      mutatedRuns: 10,
      comparableMutatedRuns: 8,
    },
  ], 0.7);

  expect(failures).toHaveLength(1);
  expect(failures[0].row.appId).toBe('realworld');
});
