import type { APIRequestContext, Page } from '@playwright/test';
import { MutantGenerator } from '../../src/benchmark/runner/MutantGenerator';
import {
  getActiveScenarioEntries,
  type RealWorldScenarioEntry,
} from '../../src/benchmark/realworld-corpus';
import type { ScenarioTouchpointInput } from '../../src/benchmark/realworld-touchpoints';
import { appPaths } from './helpers/app';
import {
  addCommentToOpenedArticle,
  deleteOwnCommentFromOpenedArticle,
  followAndUnfollowProfile,
  getActiveBenchmarkTimeoutMs,
  openArticleBySlug,
  openFirstArticleFromFeed,
  openGlobalFeed,
  paginateTaggedFeed,
  signInWithValidCredentials,
  updateBioFromSettings,
  verifyOpenedArticleTitle,
  verifyPreviewDescription,
  visitHome,
} from './helpers/benchmark-active';
import {
  provisionAuthenticatedUser,
  provisionAuthCredentials,
} from './helpers/setup-infrastructure';
import {
  getFirstPublicArticleSummary,
} from './helpers/api';

export interface ActiveScenarioFixtures {
  page: Page;
  request: APIRequestContext;
  locators: any;
  oracle: any;
  appAdapter: any;
  applyDeferredMutation(scenarioId: string, viewContext: string): Promise<void>;
}

export interface ActiveScenarioCollectContext extends ActiveScenarioFixtures {
  generator: MutantGenerator;
  collectCheckpoint(viewContext: string, touchpoints?: ScenarioTouchpointInput[]): Promise<void>;
}

export interface ActiveScenarioDefinition extends RealWorldScenarioEntry {
  run(fixtures: ActiveScenarioFixtures): Promise<void>;
  collect(fixtures: ActiveScenarioCollectContext): Promise<void>;
}

function ensureScenarioEntry(scenarioId: string): RealWorldScenarioEntry {
  const entry = getActiveScenarioEntries().find(item => item.scenarioId === scenarioId);
  if (!entry) {
    throw new Error(`Active scenario "${scenarioId}" is missing from the corpus manifest.`);
  }
  return entry;
}

function touchpoint(logicalKey: string, role: ScenarioTouchpointInput['role'], locator: ScenarioTouchpointInput['locator']): ScenarioTouchpointInput {
  return {
    logicalKey,
    role,
    locator,
  };
}

export const ACTIVE_SCENARIOS: ActiveScenarioDefinition[] = [
  {
    ...ensureScenarioEntry('health.home-load'),
    async run({ page, oracle, applyDeferredMutation }) {
      await visitHome(page, oracle);
      await applyDeferredMutation('health.home-load', 'home');
      await oracle.nav.navbar().assertVisible();
    },
    async collect({ page, oracle, collectCheckpoint }) {
      await visitHome(page, oracle);
      await collectCheckpoint('home', [
        touchpoint('nav.brandLink', 'primary-action', oracle.nav.brandLink().raw),
        touchpoint('nav.navbar', 'context', oracle.nav.navbar().raw),
      ]);
    },
  },
  {
    ...ensureScenarioEntry('auth.sign-in-valid'),
    async run({ page, request, locators, oracle, applyDeferredMutation }) {
      const provisioned = await provisionAuthCredentials(request);
      await page.goto(appPaths.login(), { waitUntil: 'load' });
      await oracle.auth.title().assertContainsText(/sign in/i, { timeout: getActiveBenchmarkTimeoutMs() });
      await applyDeferredMutation('auth.sign-in-valid', 'login-form');
      await signInWithValidCredentials(page, locators, oracle, provisioned.credentials.email, provisioned.credentials.password, { navigateToLogin: false });
    },
    async collect({ page, request, locators, oracle, collectCheckpoint }) {
      const provisioned = await provisionAuthCredentials(request);
      await page.goto(appPaths.login(), { waitUntil: 'load' });
      await oracle.auth.title().assertVisible({ timeout: getActiveBenchmarkTimeoutMs() });
      await collectCheckpoint('login-form', [
        touchpoint('auth.emailInput', 'secondary-action', locators.auth.emailInput().raw),
        touchpoint('auth.passwordInput', 'secondary-action', locators.auth.passwordInput().raw),
        touchpoint('auth.submitButton', 'primary-action', locators.auth.submitButton().raw),
      ]);
      await signInWithValidCredentials(page, locators, oracle, provisioned.credentials.email, provisioned.credentials.password);
    },
  },
  {
    ...ensureScenarioEntry('feed.open-global-feed'),
    async run({ page, locators, oracle, applyDeferredMutation }) {
      await visitHome(page, oracle);
      await applyDeferredMutation('feed.open-global-feed', 'home-before-global-feed');
      await locators.nav.globalFeedTab().click();
      await oracle.home.firstReadMoreLink().assertVisible({ timeout: getActiveBenchmarkTimeoutMs() });
    },
    async collect({ page, locators, oracle, collectCheckpoint }) {
      await visitHome(page, oracle);
      await collectCheckpoint('home-before-global-feed', [
        touchpoint('nav.globalFeedTab', 'primary-action', locators.nav.globalFeedTab().raw),
      ]);
    },
  },
  {
    ...ensureScenarioEntry('article.open-from-feed'),
    async run({ page, locators, oracle, applyDeferredMutation }) {
      await openGlobalFeed(page, locators, oracle);
      await applyDeferredMutation('article.open-from-feed', 'global-feed-before-open');
      await Promise.all([
        page.waitForURL(/\/article\/.+/),
        locators.home.firstReadMoreLink().click(),
      ]);
      await oracle.article.page().assertVisible({ timeout: getActiveBenchmarkTimeoutMs() });
    },
    async collect({ page, locators, oracle, collectCheckpoint }) {
      await openGlobalFeed(page, locators, oracle);
      await collectCheckpoint('global-feed-before-open', [
        touchpoint('home.firstReadMoreLink', 'primary-action', locators.home.firstReadMoreLink().raw),
        touchpoint('nav.globalFeedTab', 'navigation', locators.nav.globalFeedTab().raw),
      ]);
    },
  },
  {
    ...ensureScenarioEntry('article.favorite-from-detail'),
    async run({ page, request, appAdapter, locators, oracle, applyDeferredMutation }) {
      await provisionAuthenticatedUser(page, request, appAdapter);
      const article = await getFirstPublicArticleSummary(request);
      await openArticleBySlug(page, oracle, article.slug);
      await oracle.article.favoriteButton().assertVisible({ timeout: getActiveBenchmarkTimeoutMs() });
      await applyDeferredMutation('article.favorite-from-detail', 'article-detail-before-favorite');
      await locators.article.favoriteButton().click();
      await oracle.article.unfavoriteButton().assertVisible({ timeout: getActiveBenchmarkTimeoutMs() });
    },
    async collect({ page, request, appAdapter, oracle, collectCheckpoint }) {
      await provisionAuthenticatedUser(page, request, appAdapter);
      const article = await getFirstPublicArticleSummary(request);
      await openArticleBySlug(page, oracle, article.slug);
      await oracle.article.favoriteButton().assertVisible({ timeout: getActiveBenchmarkTimeoutMs() });
      await collectCheckpoint('article-detail-before-favorite', [
        touchpoint('article.favoriteButton', 'primary-action', oracle.article.favoriteButton().raw),
      ]);
    },
  },
  {
    ...ensureScenarioEntry('article.preview-description-visibility'),
    async run({ page, locators, oracle, applyDeferredMutation }) {
      await openGlobalFeed(page, locators, oracle);
      await oracle.home.firstArticlePreview().assertVisible({ timeout: getActiveBenchmarkTimeoutMs() });
      await applyDeferredMutation('article.preview-description-visibility', 'global-feed-before-preview-description');
      await verifyPreviewDescription(locators, oracle, /\S+/);
    },
    async collect({ page, locators, oracle, collectCheckpoint }) {
      await openGlobalFeed(page, locators, oracle);
      await oracle.home.firstArticlePreview().assertVisible({ timeout: getActiveBenchmarkTimeoutMs() });
      await collectCheckpoint('global-feed-before-preview-description', [
        touchpoint('home.previewDescription', 'assertion', oracle.home.previewDescription(oracle.home.firstArticlePreview().raw).raw),
      ]);
    },
  },
  {
    ...ensureScenarioEntry('navigation.pagination'),
    async run({ page, locators, oracle, applyDeferredMutation }) {
      await openGlobalFeed(page, locators, oracle);
      await oracle.home.paginationButton(2).assertVisible({ timeout: getActiveBenchmarkTimeoutMs() });
      await applyDeferredMutation('navigation.pagination', 'global-feed-before-pagination');
      await paginateTaggedFeed(locators, oracle, 2);
    },
    async collect({ page, locators, oracle, collectCheckpoint }) {
      await openGlobalFeed(page, locators, oracle);
      await oracle.home.paginationButton(2).assertVisible({ timeout: getActiveBenchmarkTimeoutMs() });
      await collectCheckpoint('global-feed-before-pagination', [
        touchpoint('home.paginationButton', 'primary-action', locators.home.paginationButton(2).raw),
        touchpoint('home.paginationItem', 'assertion', oracle.home.paginationItem(2).raw),
      ]);
    },
  },
  {
    ...ensureScenarioEntry('comments.delete-own'),
    async run({ page, request, appAdapter, locators, oracle, applyDeferredMutation }) {
        await provisionAuthenticatedUser(page, request, appAdapter);
        const article = await getFirstPublicArticleSummary(request);
        const commentText = `Benchmark delete comment ${Date.now()}`;
        await openArticleBySlug(page, oracle, article.slug);
        const commentId = await addCommentToOpenedArticle(locators, oracle, commentText);
        await applyDeferredMutation('comments.delete-own', 'article-detail-before-comment-delete');
        await deleteOwnCommentFromOpenedArticle(locators, oracle, commentId);
      },
    async collect({ page, request, appAdapter, locators, oracle, collectCheckpoint }) {
      await provisionAuthenticatedUser(page, request, appAdapter);
      const article = await getFirstPublicArticleSummary(request);
      const commentText = `Benchmark delete comment ${Date.now()}`;
      await openArticleBySlug(page, oracle, article.slug);
      const commentId = await addCommentToOpenedArticle(locators, oracle, commentText);
      await collectCheckpoint('article-detail-before-comment-delete', [
        touchpoint('comments.deleteButton', 'primary-action', locators.comments.deleteButton(oracle.comments.cardById(commentId)).raw),
      ]);
    },
  },
  {
    ...ensureScenarioEntry('comments.add-on-article'),
    async run({ page, request, appAdapter, locators, oracle, applyDeferredMutation }) {
      await provisionAuthenticatedUser(page, request, appAdapter);
      await openFirstArticleFromFeed(page, locators, oracle);
      await applyDeferredMutation('comments.add-on-article', 'article-detail-before-comment');
      await addCommentToOpenedArticle(locators, oracle, `Benchmark comment ${Date.now()}`);
    },
    async collect({ page, request, appAdapter, locators, oracle, collectCheckpoint }) {
      await provisionAuthenticatedUser(page, request, appAdapter);
      await openFirstArticleFromFeed(page, locators, oracle);
      await collectCheckpoint('article-detail-before-comment', [
        touchpoint('comments.textarea', 'secondary-action', locators.comments.textarea().raw),
        touchpoint('comments.submitButton', 'primary-action', locators.comments.submitButton().raw),
      ]);
    },
  },
  {
    ...ensureScenarioEntry('article.assert-title'),
    async run({ page, request, locators, oracle, applyDeferredMutation }) {
      const article = await getFirstPublicArticleSummary(request);
      await openArticleBySlug(page, oracle, article.slug);
      await applyDeferredMutation('article.assert-title', 'article-detail-before-title-assert');
      await verifyOpenedArticleTitle(locators, oracle, article.title);
    },
    async collect({ page, request, oracle, collectCheckpoint }) {
      const article = await getFirstPublicArticleSummary(request);
      await openArticleBySlug(page, oracle, article.slug);
      await collectCheckpoint('article-detail-before-title-assert', [
        touchpoint('article.title', 'assertion', oracle.article.title().raw),
      ]);
    },
  },
  {
    ...ensureScenarioEntry('social.follow-unfollow'),
    async run({ page, request, appAdapter, locators, oracle, applyDeferredMutation }) {
      await provisionAuthenticatedUser(page, request, appAdapter);
      const article = await getFirstPublicArticleSummary(request);
      await page.goto(appPaths.profile(article.authorUsername), { waitUntil: 'load' });
      await oracle.profile.page().assertVisible({ timeout: getActiveBenchmarkTimeoutMs() });
      await oracle.profile.followButton().assertVisible({ timeout: getActiveBenchmarkTimeoutMs() });
      await applyDeferredMutation('social.follow-unfollow', 'profile-before-follow-toggle');
      await followAndUnfollowProfile(locators, oracle);
    },
    async collect({ page, request, appAdapter, oracle, collectCheckpoint }) {
      await provisionAuthenticatedUser(page, request, appAdapter);
      const article = await getFirstPublicArticleSummary(request);
      await page.goto(appPaths.profile(article.authorUsername), { waitUntil: 'load' });
      await oracle.profile.page().assertVisible({ timeout: getActiveBenchmarkTimeoutMs() });
      await oracle.profile.followButton().assertVisible({ timeout: getActiveBenchmarkTimeoutMs() });
      await collectCheckpoint('profile-before-follow-toggle', [
        touchpoint('profile.followButton', 'primary-action', oracle.profile.followButton().raw),
      ]);
    },
  },
  {
    ...ensureScenarioEntry('settings.update-bio'),
    async run({ page, request, appAdapter, locators, oracle, applyDeferredMutation }) {
      const provisioned = await provisionAuthenticatedUser(page, request, appAdapter);
      await page.goto(appPaths.settings(), { waitUntil: 'load' });
      await oracle.settings.page().assertVisible({ timeout: getActiveBenchmarkTimeoutMs() });
      await applyDeferredMutation('settings.update-bio', 'settings-form');
      await updateBioFromSettings(page, locators, oracle, `Bio updated ${Date.now()}`, {
        navigateToSettings: false,
        profileUsername: provisioned.credentials.username,
      });
    },
    async collect({ page, request, appAdapter, locators, oracle, collectCheckpoint }) {
      await provisionAuthenticatedUser(page, request, appAdapter);
      await page.goto(appPaths.settings(), { waitUntil: 'load' });
      await oracle.settings.page().assertVisible({ timeout: getActiveBenchmarkTimeoutMs() });
      await collectCheckpoint('settings-form', [
        touchpoint('settings.bioInput', 'secondary-action', locators.settings.bioInput().raw),
        touchpoint('settings.submitButton', 'primary-action', locators.settings.submitButton().raw),
      ]);
    },
  },
];

export function getActiveScenarioDefinitions(): ActiveScenarioDefinition[] {
  return ACTIVE_SCENARIOS;
}
