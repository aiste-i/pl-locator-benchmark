import { test, expect } from '@playwright/test';
import { MutationRecord } from '../../src/webmutator/MutationRecord';
import { DomOperators } from '../../src/webmutator/operators/DomOperators';
import { OperatorRegistry } from '../../src/webmutator/operators/OperatorRegistry';
import { getBenchmarkOperatorCatalog, getOperatorCatalog } from '../../src/webmutator/operators/catalog';
import { SwapAdjacentSiblings } from '../../src/webmutator/operators/dom/SwapAdjacentSiblings';
import { ReverseChildrenOrder } from '../../src/webmutator/operators/dom/ReverseChildrenOrder';
import { StylePosition } from '../../src/webmutator/operators/dom/StylePosition';
import { StyleSize } from '../../src/webmutator/operators/dom/StyleSize';
import { StyleVisibility } from '../../src/webmutator/operators/dom/StyleVisibility';
import { SubtreeDelete } from '../../src/webmutator/operators/dom/SubtreeDelete';
import { SubtreeMove } from '../../src/webmutator/operators/dom/SubtreeMove';
import { SubtreeSwap } from '../../src/webmutator/operators/dom/SubtreeSwap';
import { ToggleCssClass } from '../../src/webmutator/operators/dom/ToggleCssClass';
import { ToggleAriaExpanded } from '../../src/webmutator/operators/dom/accessibility/ToggleAriaExpanded';

test('dom operator list includes the expanded RealWorld benchmark stressors', async () => {
  const operatorNames = DomOperators.getDomOperators().map(operator => operator.constructor.name);

  expect(operatorNames).toContain('ReverseChildrenOrder');
  expect(operatorNames).toContain('SwapAdjacentSiblings');
  expect(operatorNames).toContain('NeutralWrapperInsert');
  expect(operatorNames).toContain('AncestorSink');
  expect(operatorNames).toContain('LabelMechanismRewrite');
  expect(operatorNames).toContain('AccessibleNameSourceSwap');
  expect(operatorNames).toContain('ChangeAriaLabel');
  expect(operatorNames).toContain('ToggleAriaExpanded');
  expect(operatorNames).toContain('ToggleCssClass');
});

test('operator catalog makes in-scope and excluded-by-design coverage explicit', async () => {
  const benchmarkOperators = getBenchmarkOperatorCatalog().map(entry => entry.type);
  const fullCatalog = getOperatorCatalog();

  expect(benchmarkOperators).toContain('ToggleAriaExpanded');
  expect(benchmarkOperators).toContain('NeutralWrapperRemove');
  expect(benchmarkOperators).toContain('NonTargetDuplicateControlInsert');
  expect(benchmarkOperators).not.toContain('DistortMutator');
  expect(benchmarkOperators).not.toContain('MaskMutator');

  const excludedVisualOperators = fullCatalog.filter(entry => entry.benchmarkScope === 'excluded-by-design');
  expect(excludedVisualOperators.map(entry => entry.type).sort()).toEqual(['DistortMutator', 'MaskMutator']);
  expect(excludedVisualOperators.every(entry => entry.excludedReason)).toBe(true);
});

test('operator registry can recreate the expanded operator set', async () => {
  expect(OperatorRegistry.createOperator('ReverseChildrenOrder').constructor.name).toBe('ReverseChildrenOrder');
  expect(OperatorRegistry.createOperator('SwapAdjacentSiblings').constructor.name).toBe('SwapAdjacentSiblings');
  expect(OperatorRegistry.createOperator('NeutralWrapperInsert').constructor.name).toBe('NeutralWrapperInsert');
  expect(OperatorRegistry.createOperator('LabelMechanismRewrite').constructor.name).toBe('LabelMechanismRewrite');
  expect(OperatorRegistry.createOperator('ChangeAriaLabel').constructor.name).toBe('ChangeAriaLabel');
  expect(OperatorRegistry.createOperator('ToggleAriaExpanded').constructor.name).toBe('ToggleAriaExpanded');
  expect(OperatorRegistry.createOperator('ToggleCssClass').constructor.name).toBe('ToggleCssClass');
});

test('SwapAdjacentSiblings swaps the target with its next sibling', async ({ page }) => {
  await page.setContent(`
    <div id="stack">
      <p id="first">First</p>
      <p id="second">Second</p>
      <p id="third">Third</p>
    </div>
  `);

  const operator = new SwapAdjacentSiblings();
  const target = page.locator('#first');
  const record = new MutationRecord(true);

  expect(await operator.isApplicable(page, target)).toBe(true);
  await operator.applyOperator(page, target, record);

  const order = await page.locator('#stack > *').evaluateAll(nodes =>
    nodes.map(node => (node as HTMLElement).id),
  );

  expect(order).toEqual(['second', 'first', 'third']);
  expect(record.data?.action).toBe('SwapAdjacentSiblings');
});

test('ToggleCssClass mutates regular nodes but skips oracle-protected ones', async ({ page }) => {
  await page.setContent(`
    <button id="mutate-me" class="btn btn-primary">Save</button>
    <button id="protected" data-testid="oracle-button" class="btn btn-primary">Protected</button>
  `);

  const operator = new ToggleCssClass();
  const target = page.locator('#mutate-me');
  const protectedTarget = page.locator('#protected');
  const record = new MutationRecord(true);

  expect(await operator.isApplicable(page, target)).toBe(true);
  expect(await operator.isApplicable(page, protectedTarget)).toBe(false);

  await operator.applyOperator(page, target, record);

  await expect(target).toHaveClass(/btn-outline-primary/);
  expect(record.data?.type).toBe('ToggleCssClass');
  expect(record.data?.originalClassName).toContain('btn-primary');
});

test('ToggleAriaExpanded flips aria-expanded while honoring oracle safety', async ({ page }) => {
  await page.setContent(`
    <button id="menu-toggle" aria-label="Open menu" aria-expanded="false">Menu</button>
    <button id="protected-toggle" data-testid="oracle-toggle" aria-expanded="false">Protected</button>
  `);

  const operator = new ToggleAriaExpanded();
  const target = page.locator('#menu-toggle');
  const protectedTarget = page.locator('#protected-toggle');
  const record = new MutationRecord(true);

  expect(await operator.isApplicable(page, target)).toBe(true);
  expect(await operator.isApplicable(page, protectedTarget)).toBe(false);

  await operator.applyOperator(page, target, record);

  await expect(target).toHaveAttribute('aria-expanded', 'true');
  expect(record.data).toEqual({
    type: 'ToggleAriaExpanded',
    originalValue: 'false',
    newValue: 'true',
  });
});

test('visibility-style operators skip interactive controls and mutate safe presentation nodes non-destructively', async ({ page }) => {
  await page.setContent(`
    <div id="safe-copy">Summary text</div>
    <button id="cta-button">Publish</button>
    <div id="form-shell"><input id="title-input" /></div>
  `);

  const safeNode = page.locator('#safe-copy');
  const interactiveButton = page.locator('#cta-button');
  const formShell = page.locator('#form-shell');

  const visibility = new StyleVisibility();
  const position = new StylePosition();
  const size = new StyleSize();

  expect(await visibility.isApplicable(page, safeNode)).toBe(true);
  expect(await position.isApplicable(page, safeNode)).toBe(true);
  expect(await size.isApplicable(page, safeNode)).toBe(true);
  expect(await visibility.isApplicable(page, interactiveButton)).toBe(false);
  expect(await position.isApplicable(page, interactiveButton)).toBe(false);
  expect(await size.isApplicable(page, formShell)).toBe(false);

  const visibilityRecord = new MutationRecord(true);
  await visibility.applyOperator(page, safeNode, visibilityRecord);
  await expect(safeNode).toBeVisible();
  expect(visibilityRecord.data?.opacity).toBe('0.35');

  const positionRecord = new MutationRecord(true);
  await position.applyOperator(page, safeNode, positionRecord);
  expect(positionRecord.data?.transform).toContain('translate');

  const sizeRecord = new MutationRecord(true);
  await size.applyOperator(page, safeNode, sizeRecord);
  expect(sizeRecord.data?.transform).toContain('scale');
});

test('structural operators skip containers with interactive descendants', async ({ page }) => {
  await page.setContent(`
    <div id="safe-structure">
      <p>Alpha</p>
      <p>Beta</p>
      <p>Gamma</p>
    </div>
    <div id="move-parent">
      <p id="move-me">Move me</p>
      <div id="drop-zone"><span>Drop zone</span></div>
    </div>
    <div id="unsafe-structure">
      <button>Save</button>
      <button>Cancel</button>
    </div>
  `);

  const safeStructure = page.locator('#safe-structure');
  const safeMoveTarget = page.locator('#move-me');
  const unsafeStructure = page.locator('#unsafe-structure');
  expect(await new SubtreeDelete().isApplicable(page, safeStructure)).toBe(true);
  expect(await new SubtreeDelete().isApplicable(page, unsafeStructure)).toBe(false);
  expect(await new SubtreeMove().isApplicable(page, safeMoveTarget)).toBe(true);
  expect(await new SubtreeMove().isApplicable(page, page.locator('#unsafe-structure button').first())).toBe(false);
  expect(await new SubtreeSwap().isApplicable(page, safeStructure)).toBe(true);
  expect(await new SubtreeSwap().isApplicable(page, unsafeStructure)).toBe(false);
  expect(await new ReverseChildrenOrder().isApplicable(page, safeStructure)).toBe(true);
  expect(await new ReverseChildrenOrder().isApplicable(page, unsafeStructure)).toBe(false);

  const siblingSwap = new SwapAdjacentSiblings();
  expect(await siblingSwap.isApplicable(page, page.locator('#safe-structure p').first())).toBe(true);
  expect(await siblingSwap.isApplicable(page, page.locator('#unsafe-structure button').first())).toBe(false);
});
