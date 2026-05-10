import { test, expect } from '@playwright/test';
import { MutantGenerator } from '../../src/benchmark/runner/MutantGenerator';
import { MutationCandidate } from '../../src/webmutator/MutationCandidate';
import { TextReplace } from '../../src/webmutator/operators/dom/TextReplace';
import { StyleVisibility } from '../../src/webmutator/operators/dom/StyleVisibility';
import { SubtreeDelete } from '../../src/webmutator/operators/dom/SubtreeDelete';
import { ChangeAriaLabel } from '../../src/webmutator/operators/dom/accessibility/ChangeAriaLabel';

function candidatePool(): MutationCandidate[] {
  const factories = [
    () => new TextReplace('mutated'),
    () => new StyleVisibility(),
    () => new SubtreeDelete(),
    () => new ChangeAriaLabel(),
  ];

  return Array.from({ length: 32 }, (_, index) => {
    const operator = factories[index % factories.length]();
    return new MutationCandidate(`#target-${index}`, operator, 'http://example.test', { tagType: 'div' }, {
      applicationId: 'angular-realworld-example-app',
      candidateId: `candidate-${index.toString().padStart(2, '0')}`,
      scenarioId: `scenario-${index % 5}`,
      viewContext: `view-${index % 3}`,
      eligible: true,
      aggregateComparisonEligible: true,
    });
  });
}

function selectIds(candidates: MutationCandidate[], budget: number, seed: number): string[] {
  const generator = new MutantGenerator(null as any, 'angular-realworld-example-app');
  return generator.sampleScenarios(candidates, budget, seed).map(candidate => candidate.candidateId!);
}

function insertionOrderVariant(candidates: MutationCandidate[]): MutationCandidate[] {
  const byId: Record<string, MutationCandidate> = {};
  for (const candidate of [...candidates].reverse()) {
    byId[candidate.candidateId!] = candidate;
  }
  return Object.values(byId);
}

test('same seed, same pool, and same budget select the same mutation IDs in order', () => {
  const candidates = candidatePool();

  expect(selectIds(candidates, 12, 12345)).toEqual(selectIds(candidates, 12, 12345));
});

test('different seed changes deterministic mutation selection', () => {
  const candidates = candidatePool();

  expect(selectIds(candidates, 12, 12345)).not.toEqual(selectIds(candidates, 12, 54321));
});

test('candidate ordering normalization is deterministic', () => {
  const candidates = candidatePool();

  expect(selectIds(candidates, 12, 98765)).toEqual(selectIds([...candidates].reverse(), 12, 98765));
});

test('selection does not depend on object insertion order or filesystem-like ordering', () => {
  const candidates = candidatePool();
  const filesystemLikeOrder = [...candidates].sort((left, right) => right.selector.localeCompare(left.selector));

  expect(selectIds(candidates, 12, 24680)).toEqual(selectIds(insertionOrderVariant(filesystemLikeOrder), 12, 24680));
});
