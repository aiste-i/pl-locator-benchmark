import type { Page } from '@playwright/test';
import type { RealWorldLocators, RealWorldOracleLocators } from '../locators/realworld/types';
import type { StrategyName } from '../locators';

export type SupportedAppId =
  | 'angular-realworld-example-app'
  | 'realworld'
  | 'vue3-realworld-example-app';

export interface AppPathBuilder {
  home(): string;
  login(): string;
  register(): string;
  settings(): string;
  editor(slug?: string): string;
  article(slug: string): string;
  profile(username: string): string;
  profileFavorites(username: string): string;
  tag(tag: string, page?: number): string;
  followingFeed(page?: number): string;
}

export interface BootstrapUser {
  username: string;
  email: string;
  token: string;
  bio?: string | null;
  image?: string | null;
}

export interface AppAdapter {
  id: SupportedAppId;
  displayName: string;
  rootDir: string;
  startCommand: string;
  baseURL: string;
  healthUrl: string;
  testMatch: string[];
  env?: Record<string, string>;
  paths: AppPathBuilder;
  getLocators(strategy: StrategyName): any;
  getOracle(): any;
  bootstrapAuthenticatedSession?(page: Page, user: BootstrapUser): Promise<void>;
}
