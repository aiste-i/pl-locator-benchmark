import type { APIRequestContext, Page } from '@playwright/test';
import { MutantGenerator } from '../../src/benchmark/runner/MutantGenerator';
import {
  getSemanticSupplementScenarioEntriesForApp,
  type RealWorldSemanticSupplementScenarioEntry,
} from '../../src/benchmark/realworld-corpus';
import { getSelectedAppId } from '../../src/apps';
import type { ScenarioTouchpointInput } from '../../src/benchmark/realworld-touchpoints';
import { appPaths } from './helpers/app';
import {
  addCommentToOpenedArticle,
  getActiveBenchmarkTimeoutMs,
  openArticleBySlug,
  openFirstArticleFromFeed,
} from './helpers/benchmark-active';
import {
  getFirstPublicArticleSummary,
} from './helpers/api';
import {
  provisionAuthenticatedUser,
  provisionAuthCredentials,
} from './helpers/setup-infrastructure';

export interface SemanticSupplementFixtures {
  page: Page;
  request: APIRequestContext;
  locators: any;
  oracle: any;
  appAdapter: any;
  applyDeferredMutation(scenarioId: string, viewContext: string): Promise<void>;
}

export interface SemanticSupplementCollectContext extends SemanticSupplementFixtures {
  generator: MutantGenerator;
  collectCheckpoint(viewContext: string, touchpoints?: ScenarioTouchpointInput[]): Promise<void>;
}

export interface SemanticSupplementScenarioDefinition extends RealWorldSemanticSupplementScenarioEntry {
  run(fixtures: SemanticSupplementFixtures): Promise<void>;
  collect(fixtures: SemanticSupplementCollectContext): Promise<void>;
}

function touchpoint(
  logicalKey: string,
  role: ScenarioTouchpointInput['role'],
  locator: ScenarioTouchpointInput['locator'],
): ScenarioTouchpointInput {
  return {
    logicalKey,
    role,
    locator,
  };
}

function ensureScenarioEntry(scenarioId: string): RealWorldSemanticSupplementScenarioEntry {
  const appId = getSelectedAppId();
  const entry = getSemanticSupplementScenarioEntriesForApp(appId).find(item => item.scenarioId === scenarioId);
  if (!entry) {
    throw new Error(`Semantic supplement scenario "${scenarioId}" is not supported for ${appId}.`);
  }
  return entry;
}

function semanticCommentText(): string {
  return `Semantic placeholder comment ${Date.now()}`;
}

async function createSupplementArticle(request: APIRequestContext) {
  const article = await getFirstPublicArticleSummary(request);
  return {
    article,
    slug: article.slug,
  };
}

async function prepareProfileAvatar(page: Page, request: APIRequestContext) {
  const article = await getFirstPublicArticleSummary(request);
  await page.goto(appPaths.profile(article.authorUsername), { waitUntil: 'load' });
  return article.authorUsername;
}

const SEMANTIC_SUPPLEMENT_SCENARIO_FACTORIES: Array<{
  scenarioId: string;
  create: () => SemanticSupplementScenarioDefinition;
}> = [
  {
    scenarioId: 'semantic.auth-email-label',
    create: () => ({
    ...ensureScenarioEntry('semantic.auth-email-label'),
    async run({ page, request, locators, oracle, applyDeferredMutation }) {
      const provisioned = await provisionAuthCredentials(request);
      await page.goto(appPaths.login(), { waitUntil: 'load' });
      await oracle.auth.title().assertContainsText(/sign in/i, { timeout: getActiveBenchmarkTimeoutMs() });
      await applyDeferredMutation('semantic.auth-email-label', 'login-email-label');
      await locators.auth.emailLabelInput().fill(provisioned.credentials.email);
      await oracle.auth.emailLabelInput().assertValue(provisioned.credentials.email, {
        timeout: getActiveBenchmarkTimeoutMs(),
      });
    },
    async collect({ page, request, locators, oracle, collectCheckpoint }) {
      await provisionAuthCredentials(request);
      await page.goto(appPaths.login(), { waitUntil: 'load' });
      await oracle.auth.title().assertContainsText(/sign in/i, { timeout: getActiveBenchmarkTimeoutMs() });
      await collectCheckpoint('login-email-label', [
        touchpoint('auth.emailLabelInput', 'primary-action', locators.auth.emailLabelInput().raw),
      ]);
    },
    }),
  },
  {
    scenarioId: 'semantic.comment-placeholder',
    create: () => ({
    ...ensureScenarioEntry('semantic.comment-placeholder'),
    async run({ page, request, appAdapter, locators, oracle, applyDeferredMutation }) {
      await provisionAuthenticatedUser(page, request, appAdapter);
      await openFirstArticleFromFeed(page, locators, oracle);
      const commentText = semanticCommentText();
      await applyDeferredMutation('semantic.comment-placeholder', 'article-comment-placeholder');
      await locators.comments.textarea().fill(commentText);
      await oracle.comments.textarea().assertValue(commentText, { timeout: getActiveBenchmarkTimeoutMs() });
    },
    async collect({ page, request, appAdapter, locators, oracle, collectCheckpoint }) {
      await provisionAuthenticatedUser(page, request, appAdapter);
      await openFirstArticleFromFeed(page, locators, oracle);
      await collectCheckpoint('article-comment-placeholder', [
        touchpoint('comments.textarea', 'primary-action', locators.comments.textarea().raw),
      ]);
    },
    }),
  },
  {
    scenarioId: 'semantic.article-title-text',
    create: () => ({
    ...ensureScenarioEntry('semantic.article-title-text'),
    async run({ page, request, locators, oracle, applyDeferredMutation }) {
      const { article, slug } = await createSupplementArticle(request);
      await openArticleBySlug(page, oracle, slug);
      await applyDeferredMutation('semantic.article-title-text', 'article-title-text');
      await locators.article.titleText(article.title).waitFor({
        state: 'visible',
        timeout: getActiveBenchmarkTimeoutMs(),
      });
      await oracle.article.titleText(article.title).assertContainsText(article.title, {
        timeout: getActiveBenchmarkTimeoutMs(),
      });
    },
    async collect({ page, request, locators, oracle, collectCheckpoint }) {
      const { article, slug } = await createSupplementArticle(request);
      await openArticleBySlug(page, oracle, slug);
      await collectCheckpoint('article-title-text', [
        touchpoint('article.titleText', 'assertion', locators.article.titleText(article.title).raw),
      ]);
    },
    }),
  },
  {
    scenarioId: 'semantic.profile-avatar-alt',
    create: () => ({
    ...ensureScenarioEntry('semantic.profile-avatar-alt'),
    async run({ page, request, locators, oracle, applyDeferredMutation }) {
      const username = await prepareProfileAvatar(page, request);
      await oracle.profile.page().assertVisible({ timeout: getActiveBenchmarkTimeoutMs() });
      await applyDeferredMutation('semantic.profile-avatar-alt', 'profile-avatar-alt');
      await locators.profile.avatarImage(username).waitFor({
        state: 'visible',
        timeout: getActiveBenchmarkTimeoutMs(),
      });
      await oracle.profile.avatarImage(username).assertVisible({
        timeout: getActiveBenchmarkTimeoutMs(),
      });
    },
    async collect({ page, request, locators, oracle, collectCheckpoint }) {
      const username = await prepareProfileAvatar(page, request);
      await oracle.profile.page().assertVisible({ timeout: getActiveBenchmarkTimeoutMs() });
      await collectCheckpoint('profile-avatar-alt', [
        touchpoint('profile.avatarImage', 'assertion', locators.profile.avatarImage(username).raw),
      ]);
    },
    }),
  },
];

export function getSemanticSupplementScenarioDefinitions(): SemanticSupplementScenarioDefinition[] {
  const supportedScenarioIds = new Set(getSemanticSupplementScenarioEntriesForApp(getSelectedAppId()).map(entry => entry.scenarioId));
  return SEMANTIC_SUPPLEMENT_SCENARIO_FACTORIES
    .filter(factory => supportedScenarioIds.has(factory.scenarioId))
    .map(factory => factory.create());
}
