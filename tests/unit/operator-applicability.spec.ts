import { test, expect } from '@playwright/test';
import { getBenchmarkOperatorCatalog } from '../../src/webmutator/operators/catalog';
import { evaluateMutationApplicability } from '../../src/webmutator/operators/applicability';
import { WebMutator } from '../../src/webmutator/WebMutator';
import { SubtreeDelete } from '../../src/webmutator/operators/dom/SubtreeDelete';
import { SubtreeMove } from '../../src/webmutator/operators/dom/SubtreeMove';
import { TextReplace } from '../../src/webmutator/operators/dom/TextReplace';
import { TextDelete } from '../../src/webmutator/operators/dom/TextDelete';
import { TextNodeMutator } from '../../src/webmutator/operators/dom/TextNodeMutator';
import { StyleVisibility } from '../../src/webmutator/operators/dom/StyleVisibility';
import { StyleColor } from '../../src/webmutator/operators/dom/StyleColor';
import { TagMutator } from '../../src/webmutator/operators/dom/TagMutator';
import { ContainerNodeMutator } from '../../src/webmutator/operators/dom/ContainerNodeMutator';
import { ChangeAriaLabel } from '../../src/webmutator/operators/dom/accessibility/ChangeAriaLabel';
import { MutateAccessibleNameText } from '../../src/webmutator/operators/dom/accessibility/MutateAccessibleNameText';
import { MutatePlaceholderText } from '../../src/webmutator/operators/dom/accessibility/MutatePlaceholderText';
import { RemovePlaceholderText } from '../../src/webmutator/operators/dom/accessibility/RemovePlaceholderText';
import { captureMutationSurface } from '../../src/benchmark/mutation-surface';
import { MutantGenerator } from '../../src/benchmark/runner/MutantGenerator';

test('each in-scope operator exposes an explicit applicability check', () => {
  for (const entry of getBenchmarkOperatorCatalog()) {
    const operator = entry.factory();
    expect(typeof operator.isApplicable, entry.type).toBe('function');
  }
});

test('structural applicability accepts safe containers and rejects interactive targets deterministically', async ({ page }) => {
  await page.setContent(`
    <div id="safe"><p>Alpha</p><p>Beta</p></div>
    <div id="unsafe"><button>Save</button></div>
  `);

  const operator = new SubtreeDelete();
  const positive = await evaluateMutationApplicability(page, page.locator('#safe'), operator);
  const negative = await evaluateMutationApplicability(page, page.locator('#unsafe'), operator);

  expect(positive).toEqual({ applicable: true, reason: null });
  expect(negative).toEqual({ applicable: false, reason: 'behavior-preservation-gate-failed' });
});

test('content applicability accepts non-empty text and rejects empty text deterministically', async ({ page }) => {
  await page.setContent(`
    <p id="copy">Readable content</p>
    <p id="empty">   </p>
  `);

  const operator = new TextReplace('mutated');

  expect(await evaluateMutationApplicability(page, page.locator('#copy'), operator)).toEqual({
    applicable: true,
    reason: null,
  });
  expect(await evaluateMutationApplicability(page, page.locator('#empty'), operator)).toEqual({
    applicable: false,
    reason: 'behavior-preservation-gate-failed',
  });
});

test('accessibility-semantic applicability accepts matching ARIA targets and rejects non-matching targets', async ({ page }) => {
  await page.setContent(`
    <button id="labelled" aria-label="Open menu">Menu</button>
    <button id="plain">Plain</button>
  `);

  const operator = new ChangeAriaLabel();

  expect(await evaluateMutationApplicability(page, page.locator('#labelled'), operator)).toEqual({
    applicable: true,
    reason: null,
  });
  expect(await evaluateMutationApplicability(page, page.locator('#plain'), operator)).toEqual({
    applicable: false,
    reason: 'behavior-preservation-gate-failed',
  });
});

test('accessible-name descendant targets can supply semantic mutations without touching protected oracle anchors', async ({ page }) => {
  await page.setContent(`
    <button data-testid="favorite-button">
      <span id="button-copy">Favorite article</span>
    </button>
    <p id="generic-copy">Decorative copy</p>
  `);

  const operator = new MutateAccessibleNameText();

  expect(await evaluateMutationApplicability(page, page.locator('#button-copy'), operator)).toEqual({
    applicable: true,
    reason: null,
  });
  expect(await evaluateMutationApplicability(page, page.locator('#generic-copy'), operator)).toEqual({
    applicable: false,
    reason: 'behavior-preservation-gate-failed',
  });

  const record = await new WebMutator().applyMutation(page, '#button-copy', operator);
  expect(record.success).toBe(true);
  await expect(page.locator('#button-copy')).toContainText('Benchmark accessible name mutation');
});

test('direct oracle anchors can accept safe accessibility-semantic mutations while oracle ancestors stay protected', async ({ page }) => {
  await page.setContent(`
    <div id="wrapper">
      <button id="favorite-button" data-testid="favorite-button" aria-label="Favorite article">Favorite article</button>
    </div>
  `);

  const operator = new ChangeAriaLabel();

  expect(await evaluateMutationApplicability(page, page.locator('#favorite-button'), operator)).toEqual({
    applicable: true,
    reason: null,
  });
  expect(await evaluateMutationApplicability(page, page.locator('#wrapper'), operator)).toEqual({
    applicable: false,
    reason: 'oracle-protected',
  });
});

test('placeholder mutations can target protected form controls without breaking oracle grounding', async ({ page }) => {
  await page.setContent(`
    <form>
      <input id="email" data-testid="email-input" type="email" placeholder="Email address" />
      <textarea id="comment" data-testid="comment-box" placeholder="Write a comment..."></textarea>
    </form>
  `);

  expect(await evaluateMutationApplicability(page, page.locator('#email'), new MutatePlaceholderText())).toEqual({
    applicable: true,
    reason: null,
  });
  expect(await evaluateMutationApplicability(page, page.locator('#comment'), new RemovePlaceholderText())).toEqual({
    applicable: true,
    reason: null,
  });

  const mutateRecord = await new WebMutator().applyMutation(page, '#email', new MutatePlaceholderText());
  const removeRecord = await new WebMutator().applyMutation(page, '#comment', new RemovePlaceholderText());

  expect(mutateRecord.success).toBe(true);
  expect(removeRecord.success).toBe(true);
  await expect(page.locator('#email')).toHaveAttribute('placeholder', 'Benchmark placeholder mutation');
  await expect(page.locator('#comment')).not.toHaveAttribute('placeholder', /.+/);
});

test('selected non-semantic operators can target protected direct anchors while preserving oracle grounding', async ({ page }) => {
  await page.setContent(`
    <div>
      <button id="favorite" data-testid="favorite-button">Favorite article</button>
      <p id="description" data-testid="article-description">Article description</p>
      <span id="counter" data-testid="article-favorite-count">12</span>
    </div>
  `);

  expect(await evaluateMutationApplicability(page, page.locator('#favorite'), new TextDelete())).toEqual({
    applicable: true,
    reason: null,
  });
  expect(await evaluateMutationApplicability(page, page.locator('#favorite'), new TextNodeMutator())).toEqual({
    applicable: true,
    reason: null,
  });
  expect(await evaluateMutationApplicability(page, page.locator('#favorite'), new StyleColor())).toEqual({
    applicable: true,
    reason: null,
  });
  expect(await evaluateMutationApplicability(page, page.locator('#description'), new TagMutator())).toEqual({
    applicable: true,
    reason: null,
  });
  expect(await evaluateMutationApplicability(page, page.locator('#counter'), new ContainerNodeMutator())).toEqual({
    applicable: true,
    reason: null,
  });
});

test('reachable-target collection keeps direct-anchor-safe accessibility operators on protected touchpoints', async ({ page }) => {
  await page.setContent(`
    <form>
      <button id="favorite-button" data-testid="favorite-button" aria-label="Favorite article">Favorite article</button>
      <input id="email-input" data-testid="email-input" type="email" placeholder="Email address" />
    </form>
  `);

  const generator = new MutantGenerator(page, 'angular-realworld-example-app');
  const targets = await generator.collectReachableTargets({
    scenarioId: 'test-scenario',
    scenarioCategory: 'test',
    sourceSpec: 'unit',
    viewContext: 'unit',
  });
  const candidates = await generator.constructScenarios(targets);
  const candidateOperators = candidates.map(candidate => `${candidate.selector}::${candidate.operator.constructor.name}`);

  expect(candidateOperators.some(value => value.endsWith('::ChangeAriaLabel'))).toBe(true);
  expect(candidateOperators.some(value => value.endsWith('::MutatePlaceholderText'))).toBe(true);
  expect(candidateOperators.some(value => value.endsWith('::RemovePlaceholderText'))).toBe(true);
});

test('visibility applicability accepts safe presentation nodes and rejects controls', async ({ page }) => {
  await page.setContent(`
    <div id="copy">Presentation copy</div>
    <button id="control">Submit</button>
  `);

  const operator = new StyleVisibility();

  expect(await evaluateMutationApplicability(page, page.locator('#copy'), operator)).toEqual({
    applicable: true,
    reason: null,
  });
  expect(await evaluateMutationApplicability(page, page.locator('#control'), operator)).toEqual({
    applicable: false,
    reason: 'behavior-preservation-gate-failed',
  });
});

test('oracle-protected targets are rejected with a clear reason', async ({ page }) => {
  await page.setContent('<p id="protected" data-testid="oracle-copy">Protected copy</p>');

  const result = await evaluateMutationApplicability(page, page.locator('#protected'), new TextReplace());

  expect(result).toEqual({ applicable: false, reason: 'oracle-protected' });
});

test('behavior-preservation gate failures surface as stable mutation skip reasons', async ({ page }) => {
  await page.setContent('<button id="control">Submit</button>');

  const record = await new WebMutator().applyMutation(page, '#control', new StyleVisibility());

  expect(record.success).toBe(false);
  expect(record.error).toContain('behavior-preservation-gate-failed');
});

test('structural mutations that move or replace the target do not hang during post-apply marking', async ({ page }) => {
  await page.setContent(`
    <div id="container">
      <div id="sibling">Sibling</div>
      <p id="move-target">Move me</p>
      <p id="tag-target">Replace me</p>
    </div>
  `);

  const mutator = new WebMutator();
  const moveRecord = await mutator.applyMutation(page, '#move-target', new SubtreeMove());
  const tagRecord = await mutator.applyMutation(page, '#tag-target', new TagMutator());

  expect(moveRecord.success).toBe(true);
  expect(tagRecord.success).toBe(true);
});

test('missing selectors return an immediate empty mutation surface snapshot', async ({ page }) => {
  await page.setContent('<div id="root"><p>hello</p></div>');

  const snapshot = await captureMutationSurface(page, '#does-not-exist');

  expect(snapshot).toEqual({
    exists: false,
    tagType: null,
    textContent: null,
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
    hidden: null,
    childElementCount: null,
    textNodeCount: null,
    parentSelector: null,
  });
});
