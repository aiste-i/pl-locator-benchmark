import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { test, expect } from '@playwright/test';
import { WebMutator } from '../../src/webmutator/WebMutator';
import { SubtreeDelete } from '../../src/webmutator/operators/dom/SubtreeDelete';
import { ToggleCssClass } from '../../src/webmutator/operators/dom/ToggleCssClass';

const ORACLE_MODULES = [
  'src/locators/apps/angular-realworld.locators.ts',
  'src/locators/apps/react-realworld.locators.ts',
  'src/locators/apps/vue3-realworld.locators.ts',
];

const BANNED_ORACLE_METHODS = new Set([
  'filter',
  'first',
  'getByAltText',
  'getByLabel',
  'getByPlaceholder',
  'getByRole',
  'getByText',
  'getByTitle',
  'last',
  'locator',
  'nth',
]);

function loadSourceFile(relativePath: string): ts.SourceFile {
  const absolutePath = path.join(process.cwd(), relativePath);
  const contents = fs.readFileSync(absolutePath, 'utf8');
  return ts.createSourceFile(relativePath, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function getCallName(expression: ts.LeftHandSideExpression): string | null {
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  return null;
}

function getOracleFunctions(sourceFile: ts.SourceFile): ts.FunctionDeclaration[] {
  return sourceFile.statements.filter((statement): statement is ts.FunctionDeclaration => {
    if (!ts.isFunctionDeclaration(statement) || !statement.name) {
      return false;
    }
    return statement.name.text.endsWith('Oracle');
  });
}

function collectOracleViolations(sourceFile: ts.SourceFile): string[] {
  const violations: string[] = [];

  for (const oracleFunction of getOracleFunctions(sourceFile)) {
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const callName = getCallName(node.expression);
        if (callName && BANNED_ORACLE_METHODS.has(callName)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.expression.getStart(sourceFile));
          violations.push(`${oracleFunction.name!.text}:${line + 1}:${character + 1}:${callName}`);
        }
      }

      ts.forEachChild(node, visit);
    };

    ts.forEachChild(oracleFunction, visit);
  }

  return violations;
}

test('oracle locator factories stay on getByTestId-only chains', async () => {
  for (const relativePath of ORACLE_MODULES) {
    const sourceFile = loadSourceFile(relativePath);
    const violations = collectOracleViolations(sourceFile);
    expect(violations, `${relativePath} oracle calls must stay on direct getByTestId chains`).toEqual([]);
  }
});

test('oracle helper paths avoid text-addressed repeated-element lookups', async () => {
  const helperFiles = [
    'tests/realworld/helpers/benchmark-active.ts',
    'tests/realworld/helpers/comments.ts',
  ];
  const forbiddenPatterns = [
    'filter({ hasText',
    'getByText(',
    "comment-card').filter",
  ];

  for (const relativePath of helperFiles) {
    const contents = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
    for (const pattern of forbiddenPatterns) {
      expect(contents.includes(pattern), `${relativePath} should not contain ${pattern}`).toBe(false);
    }
  }
});

test('mutator skips direct oracle nodes selected by data-testid', async ({ page }) => {
  await page.setContent(`
    <div data-testid="comment-card-42" class="btn btn-primary">Protected</div>
  `);

  const mutator = new WebMutator();
  const record = await mutator.applyMutation(page, '[data-testid="comment-card-42"]', new ToggleCssClass());

  expect(record.success).toBe(false);
  expect(record.error).toContain('oracle-protected');
  await expect(page.getByTestId('comment-card-42')).toHaveClass(/btn-primary/);
});

test('mutator skips structural ancestors that contain oracle roots', async ({ page }) => {
  await page.setContent(`
    <div id="comment-list">
      <div data-testid="comment-card-42">Protected child</div>
    </div>
  `);

  const mutator = new WebMutator();
  const record = await mutator.applyMutation(page, '#comment-list', new SubtreeDelete());

  expect(record.success).toBe(false);
  expect(record.error).toContain('oracle-protected');
  await expect(page.getByTestId('comment-card-42')).toBeVisible();
});

test('mutator skips mutation attempts against descendants of oracle-rooted contexts', async ({ page }) => {
  await page.setContent(`
    <section id="article-shell">
      <div data-testid="article-preview-1">
        <p id="description" data-testid="article-description">Protected description</p>
      </div>
    </section>
  `);

  const mutator = new WebMutator();
  const record = await mutator.applyMutation(page, '#description', new ToggleCssClass());

  expect(record.success).toBe(false);
  expect(record.error).toContain('oracle-protected');
  await expect(page.getByTestId('article-description')).toContainText('Protected description');
});
