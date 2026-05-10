import type { AppAdapter } from '../apps/types';

export const STRATEGIES = ['semantic-first', 'css', 'xpath'] as const;
export type StrategyName = (typeof STRATEGIES)[number];

export * from './realworld/types';
export * from './realworld/keys';
export * from './realworld/coverage';

export function getAppLocators(adapter: AppAdapter, strategy: StrategyName) {
  return adapter.getLocators(strategy);
}

export function getAppOracle(adapter: AppAdapter) {
  return adapter.getOracle();
}
