import type { APIRequestContext, Page } from '@playwright/test';
import type { AppAdapter } from '../../../src/apps/types';
import { createArticleViaAPI, registerUserObjectViaAPI, type ApiUser } from './api';
import { generateUniqueUser } from './auth';
import { generateUniqueArticle, type ArticleData } from './articles';

export interface ProvisionedUser {
  credentials: ReturnType<typeof generateUniqueUser>;
  user: ApiUser;
}

export interface ProvisionedArticle {
  author: ProvisionedUser;
  article: ArticleData;
  slug: string;
}

export async function provisionAuthenticatedUser(
  page: Page,
  request: APIRequestContext,
  appAdapter: AppAdapter,
): Promise<ProvisionedUser> {
  if (!appAdapter.bootstrapAuthenticatedSession) {
    throw new Error(`Application "${appAdapter.id}" does not define bootstrapAuthenticatedSession.`);
  }

  const credentials = generateUniqueUser();
  const user = await registerUserObjectViaAPI(request, credentials);
  await appAdapter.bootstrapAuthenticatedSession(page, user);

  return { credentials, user };
}

export async function provisionAuthCredentials(request: APIRequestContext): Promise<ProvisionedUser> {
  const credentials = generateUniqueUser();
  const user = await registerUserObjectViaAPI(request, credentials);
  return { credentials, user };
}

export async function provisionArticleViaApi(request: APIRequestContext): Promise<ProvisionedArticle> {
  const author = await provisionAuthCredentials(request);
  const article = generateUniqueArticle();
  const slug = await createArticleViaAPI(request, author.user.token, {
    title: article.title,
    description: article.description,
    body: article.body,
    tagList: article.tags ?? [],
  });

  return { author, article, slug };
}
