import type { Locator, Page } from '@playwright/test';
import type { StrategyName } from '..';
import type { SemanticLocator } from '../realworld/types';

type LocatorScope = Page | Locator;
type AnyFactory = (...args: any[]) => Locator;

export type LocatorFamily = StrategyName | 'oracle';
export type LocatorPurity = 'semantic' | 'css' | 'xpath' | 'oracle';
export type LocatorSourceKind = 'semantic-native' | 'semantic-css-exception' | 'css' | 'xpath' | 'oracle';
export type SemanticEntryPoint =
  | 'getByRole'
  | 'getByLabel'
  | 'getByText'
  | 'getByPlaceholder'
  | 'getByAltText'
  | 'getByTitle';
export type LocatorRootKind = 'semantic-entrypoint' | 'page.locator' | 'getByTestId';

export interface SemanticCssExceptionDetails {
  reason: string;
  cssSelector: string;
  activeInCorpus: boolean;
  affectsFairComparisonWording: boolean;
}

export interface LocatorFamilyMeta {
  appId: string;
  moduleId: string;
  logicalKey: string;
  family: LocatorFamily;
  purity: LocatorPurity;
  sourceKind: LocatorSourceKind;
  rootKind: LocatorRootKind;
  isException: boolean;
  selector?: string;
  semanticEntryPoint?: SemanticEntryPoint;
  exception?: SemanticCssExceptionDetails;
}

export interface LocatorMetaContext {
  appId: string;
  moduleId: string;
  logicalKey: string;
}

export const ALLOWED_SEMANTIC_ENTRY_POINTS: SemanticEntryPoint[] = [
  'getByRole',
  'getByLabel',
  'getByText',
  'getByPlaceholder',
  'getByAltText',
  'getByTitle',
];

export function markSemantic(locator: Locator, semanticEntryPoint: SemanticEntryPoint): SemanticLocator {
  (locator as SemanticLocator).semanticEntryPoint = semanticEntryPoint;
  return locator as SemanticLocator;
}

export function chooseStrategy<T extends AnyFactory>(
  strategy: StrategyName,
  implementations: Record<StrategyName, T>,
): T {
  return implementations[strategy];
}

export function getLocatorMeta(factory: unknown): LocatorFamilyMeta | undefined {
  return (factory as { __familyMeta?: LocatorFamilyMeta } | undefined)?.__familyMeta;
}

function withMeta<T extends AnyFactory>(factory: T, meta: LocatorFamilyMeta): T {
  (factory as T & { __familyMeta?: LocatorFamilyMeta }).__familyMeta = meta;
  return factory;
}

export function semanticNative<T extends AnyFactory>(
  context: LocatorMetaContext & { semanticEntryPoint: SemanticEntryPoint },
  factory: T,
): T {
  return withMeta(factory, {
    ...context,
    family: 'semantic-first',
    purity: 'semantic',
    sourceKind: 'semantic-native',
    rootKind: 'semantic-entrypoint',
    isException: false,
    semanticEntryPoint: context.semanticEntryPoint,
  });
}

export function semanticCssException<T extends AnyFactory>(
  context: LocatorMetaContext & SemanticCssExceptionDetails,
  factory?: T,
): T {
  const cssFactory =
    factory ??
    (((scope: LocatorScope) => scope.locator(`css=${context.cssSelector}`)) as unknown as T);

  return withMeta(cssFactory, {
    appId: context.appId,
    moduleId: context.moduleId,
    logicalKey: context.logicalKey,
    family: 'semantic-first',
    purity: 'css',
    sourceKind: 'semantic-css-exception',
    rootKind: 'page.locator',
    isException: true,
    selector: context.cssSelector,
    exception: {
      reason: context.reason,
      cssSelector: context.cssSelector,
      activeInCorpus: context.activeInCorpus,
      affectsFairComparisonWording: context.affectsFairComparisonWording,
    },
  });
}

export function css<T extends AnyFactory>(
  context: LocatorMetaContext & { selector: string },
  factory?: T,
): T {
  const cssFactory =
    factory ??
    (((scope: LocatorScope) => scope.locator(`css=${context.selector}`)) as unknown as T);

  return withMeta(cssFactory, {
    ...context,
    family: 'css',
    purity: 'css',
    sourceKind: 'css',
    rootKind: 'page.locator',
    isException: false,
    selector: context.selector,
  });
}

export function xpath<T extends AnyFactory>(
  context: LocatorMetaContext & { selector: string },
  factory?: T,
): T {
  const xpathFactory =
    factory ??
    (((scope: LocatorScope) => scope.locator(`xpath=${context.selector}`)) as unknown as T);

  return withMeta(xpathFactory, {
    ...context,
    family: 'xpath',
    purity: 'xpath',
    sourceKind: 'xpath',
    rootKind: 'page.locator',
    isException: false,
    selector: context.selector,
  });
}

export function oracle<T extends AnyFactory>(
  context: LocatorMetaContext & { selector: string },
  factory: T,
): T {
  return withMeta(factory, {
    ...context,
    family: 'oracle',
    purity: 'oracle',
    sourceKind: 'oracle',
    rootKind: 'getByTestId',
    isException: false,
    selector: context.selector,
  });
}

export function oracleTestId<TArgs extends any[] = []>(
  context: LocatorMetaContext,
  testId: string,
): (scope: LocatorScope, ...args: TArgs) => Locator {
  return oracle(
    {
      ...context,
      selector: `getByTestId('${testId}')`,
    },
    (((scope: LocatorScope) => scope.getByTestId(testId)) as unknown as (scope: LocatorScope, ...args: TArgs) => Locator),
  );
}

export function oracleDynamicTestId<TArgs extends any[] = []>(
  context: LocatorMetaContext,
  selectorTemplate: string,
  resolveTestId: (...args: TArgs) => string,
): (scope: LocatorScope, ...args: TArgs) => Locator {
  return oracle(
    {
      ...context,
      selector: `getByTestId('${selectorTemplate}')`,
    },
    ((scope: LocatorScope, ...args: TArgs) => scope.getByTestId(resolveTestId(...args))) as (
      scope: LocatorScope,
      ...args: TArgs
    ) => Locator,
  );
}

export function oracleTestIdChain<TArgs extends any[] = []>(
  context: LocatorMetaContext,
  selectorChain: string[],
  resolveChain?: (...args: TArgs) => string[],
): (scope: LocatorScope, ...args: TArgs) => Locator {
  const selector =
    selectorChain.map(testId => `getByTestId('${testId}')`).join('.');

  return oracle(
    {
      ...context,
      selector,
    },
    ((scope: LocatorScope, ...args: TArgs) => {
      const chain = resolveChain ? resolveChain(...args) : selectorChain;
      return chain.reduce((current, testId) => current.getByTestId(testId), scope as LocatorScope);
    }) as (scope: LocatorScope, ...args: TArgs) => Locator,
  );
}

export function getByLogicalKey(root: any, logicalKey: string): any {
  return logicalKey.split('.').reduce((current, key) => current?.[key], root);
}

export function collectLocatorFactories(
  root: Record<string, unknown>,
  prefix = '',
): Array<{ logicalKey: string; factory: AnyFactory; meta?: LocatorFamilyMeta }> {
  const rows: Array<{ logicalKey: string; factory: AnyFactory; meta?: LocatorFamilyMeta }> = [];

  for (const [key, value] of Object.entries(root)) {
    const logicalKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'function') {
      rows.push({
        logicalKey,
        factory: value as AnyFactory,
        meta: getLocatorMeta(value),
      });
      continue;
    }
    if (value && typeof value === 'object') {
      rows.push(...collectLocatorFactories(value as Record<string, unknown>, logicalKey));
    }
  }

  return rows;
}
