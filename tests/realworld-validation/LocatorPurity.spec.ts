import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { REALWORLD_APP_IDS, getAppAdapter } from '../../src/apps';
import { getActiveLogicalKeys } from '../../src/benchmark/realworld-corpus';
import { STRATEGIES } from '../../src/locators';
import {
  ALLOWED_SEMANTIC_ENTRY_POINTS,
  getByLogicalKey,
  getLocatorMeta,
  type LocatorFamilyMeta,
} from '../../src/locators/apps/shared-realworld';

const ORACLE_FAMILY = 'oracle';
const ORACLE_TEST_ID_CHAIN = /^getByTestId\('[^']+'\)(\.getByTestId\('[^']+'\))*$/;
const REALWORLD_LOCATOR_MODULES = [
  'src/locators/apps/angular-realworld.locators.ts',
  'src/locators/apps/react-realworld.locators.ts',
  'src/locators/apps/vue3-realworld.locators.ts',
];

function getRawLocatorTree(appId: (typeof REALWORLD_APP_IDS)[number], family: (typeof STRATEGIES)[number] | typeof ORACLE_FAMILY) {
  const adapter = getAppAdapter(appId);
  return family === ORACLE_FAMILY ? adapter.getOracle() : adapter.getLocators(family);
}

function getMetaOrThrow(appId: string, family: string, logicalKey: string): LocatorFamilyMeta {
  const locatorFactory = getByLogicalKey(getRawLocatorTree(appId as any, family as any), logicalKey);
  expect(typeof locatorFactory, `${appId} ${family} ${logicalKey} is missing`).toBe('function');
  const meta = getLocatorMeta(locatorFactory);
  expect(meta, `${appId} ${family} ${logicalKey} is missing family metadata`).toBeTruthy();
  return meta!;
}

function loadSourceFile(relativePath: string): ts.SourceFile {
  const absolutePath = path.join(process.cwd(), relativePath);
  const contents = fs.readFileSync(absolutePath, 'utf8');
  return ts.createSourceFile(relativePath, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function callName(expression: ts.LeftHandSideExpression): string | null {
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  return null;
}

function isHasTextFilter(node: ts.CallExpression): boolean {
  if (!ts.isPropertyAccessExpression(node.expression) || node.expression.name.text !== 'filter') {
    return false;
  }

  return node.arguments.some(argument =>
    ts.isObjectLiteralExpression(argument) &&
    argument.properties.some(property =>
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === 'hasText',
    ),
  );
}

function isIndirectSemanticTextQuery(node: ts.CallExpression): boolean {
  if (!ts.isPropertyAccessExpression(node.expression) || node.expression.name.text !== 'getByText') {
    return false;
  }

  return ts.isCallExpression(node.expression.expression);
}

function collectSemanticAntiPatterns(sourceFile: ts.SourceFile): string[] {
  const violations: string[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      if (isHasTextFilter(node) || isIndirectSemanticTextQuery(node)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        violations.push(`${line + 1}:${character + 1}:${node.getText(sourceFile)}`);
      }
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);
  return violations;
}

test('app locator modules are app-owned and do not import the shared benchmark factory', async () => {
  for (const relativePath of REALWORLD_LOCATOR_MODULES) {
    const absolutePath = path.join(process.cwd(), relativePath);
    const contents = fs.readFileSync(absolutePath, 'utf8');
    expect(contents.includes('createSharedRealWorldLocators')).toBe(false);
    expect(contents.includes('createSharedRealWorldOracle')).toBe(false);
  }
});

test('active logical locator functions expose complete metadata for benchmark families and oracle', async () => {
  const activeKeys = getActiveLogicalKeys();

  for (const appId of REALWORLD_APP_IDS) {
    for (const family of [...STRATEGIES, ORACLE_FAMILY] as const) {
      for (const logicalKey of activeKeys) {
        const meta = getMetaOrThrow(appId, family, logicalKey);
        expect(meta.family).toBe(family);
        expect(meta.appId).toBe(appId);
        expect(meta.logicalKey).toBe(logicalKey);
        expect(meta.moduleId).toContain(`${appId === 'realworld' ? 'react' : appId.startsWith('angular') ? 'angular' : 'vue3'}-realworld.locators.ts`);

        if (family === 'semantic-first') {
          expect(['semantic-native', 'semantic-css-exception']).toContain(meta.sourceKind);
          if (meta.sourceKind === 'semantic-native') {
            expect(meta.purity).toBe('semantic');
            expect(ALLOWED_SEMANTIC_ENTRY_POINTS).toContain(meta.semanticEntryPoint as any);
            expect(meta.isException).toBe(false);
          } else {
            expect(meta.purity).toBe('css');
            expect(meta.isException).toBe(true);
            expect(meta.exception).toBeTruthy();
          }
        } else if (family === 'oracle') {
          expect(meta.sourceKind).toBe('oracle');
          expect(meta.purity).toBe('oracle');
          expect(meta.selector).toMatch(ORACLE_TEST_ID_CHAIN);
        } else {
          expect(meta.sourceKind).toBe(family);
          expect(meta.purity).toBe(family);
          expect(meta.isException).toBe(false);
        }
      }
    }
  }
});

test('implemented css and xpath locator selectors never use data-testid, and oracle roots stay on getByTestId', async () => {
  for (const appId of REALWORLD_APP_IDS) {
    for (const family of [...STRATEGIES, ORACLE_FAMILY] as const) {
      const tree = getRawLocatorTree(appId, family);
      for (const logicalKey of getActiveLogicalKeys()) {
        const meta = getLocatorMeta(getByLogicalKey(tree, logicalKey));
        if (!meta?.selector) {
          continue;
        }

        if (family === 'css' || family === 'xpath') {
          expect(meta.selector).not.toContain('data-testid');
        }

        if (family === ORACLE_FAMILY) {
          expect(meta.rootKind).toBe('getByTestId');
          expect(meta.selector).toMatch(ORACLE_TEST_ID_CHAIN);
        }
      }
    }
  }
});

test('semantic-first entries use approved semantic entry points unless explicitly declared as css-backed exceptions', async () => {
  for (const appId of REALWORLD_APP_IDS) {
    const tree = getRawLocatorTree(appId, 'semantic-first');
    for (const logicalKey of getActiveLogicalKeys()) {
      const meta = getLocatorMeta(getByLogicalKey(tree, logicalKey));
      expect(meta, `${appId} semantic-first ${logicalKey} is missing`).toBeTruthy();

      if (meta?.rootKind === 'page.locator') {
        expect(meta.sourceKind).toBe('semantic-css-exception');
        expect(meta.isException).toBe(true);
      } else {
        expect(meta?.rootKind).toBe('semantic-entrypoint');
        expect(meta?.sourceKind).toBe('semantic-native');
        expect(ALLOWED_SEMANTIC_ENTRY_POINTS).toContain(meta?.semanticEntryPoint as any);
      }
    }
  }
});

test('semantic-first locator modules avoid indirect text filters and chained text narrowing', async () => {
  for (const relativePath of REALWORLD_LOCATOR_MODULES) {
    const sourceFile = loadSourceFile(relativePath);
    const violations = collectSemanticAntiPatterns(sourceFile);
    expect(violations, `${relativePath} should not use hasText filters or chained getByText narrowing in semantic-first locators`).toEqual([]);
  }
});

test('active benchmark scenario files stay on the logical locator interface for benchmark interactions', async () => {
  const files = [
    'tests/realworld/benchmark-active.scenarios.ts',
    'tests/realworld/helpers/benchmark-active.ts',
  ];
  const forbiddenPatterns = [
    'page.locator(',
    'page.getByRole(',
    'page.getByText(',
    'page.getByPlaceholder(',
    'page.getByLabel(',
    'page.getByAltText(',
    'page.getByTitle(',
    'page.getByTestId(',
  ];

  for (const relativePath of files) {
    const contents = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
    for (const pattern of forbiddenPatterns) {
      expect(contents.includes(pattern), `${relativePath} should not bypass the logical locator interface with ${pattern}`).toBe(false);
    }
  }
});
