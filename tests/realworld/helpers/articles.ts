import { Page, expect } from '@playwright/test';
import { appPaths, bindAppLocators } from './app';

export interface ArticleData {
  title: string;
  description: string;
  body: string;
  tags?: string[];
}

export async function createArticle(page: Page, article: ArticleData, options?: { sleepAfter?: number }): Promise<void>;
export async function createArticle(page: Page, locators: any, article: ArticleData, options?: { sleepAfter?: number }): Promise<void>;
export async function createArticle(
  page: Page,
  arg2: any,
  arg3?: ArticleData | { sleepAfter?: number },
  arg4: { sleepAfter?: number } = {},
): Promise<void> {
  const locators = isArticleData(arg2) ? bindAppLocators(page) : arg2;
  const article = (isArticleData(arg2) ? arg2 : arg3) as ArticleData;
  const options = ((isArticleData(arg2) ? arg3 : arg4) ?? {}) as { sleepAfter?: number };
  const { sleepAfter = 1 } = options;

  await page.goto(appPaths.editor(), { waitUntil: 'load' });

  await locators.editor.titleInput().fill(article.title);
  await locators.editor.descriptionInput().fill(article.description);
  await locators.editor.bodyInput().fill(article.body);

  if (article.tags && article.tags.length > 0) {
    for (const tag of article.tags) {
      await locators.editor.tagInput().fill(tag);
      await locators.editor.tagInput().press('Enter');
    }
  }

  // Start waiting for navigation before clicking to avoid race condition
  await Promise.all([page.waitForURL(/\/article\/.+/), locators.editor.publishButton().click()]);

  // Ensure Date.now() advances so the next generateUniqueArticle() gets a distinct timestamp
  if (sleepAfter > 0) {
    await new Promise(resolve => setTimeout(resolve, sleepAfter));
  }
}

function isArticleData(value: unknown): value is ArticleData {
  return Boolean(value && typeof value === 'object' && 'title' in value && 'description' in value && 'body' in value);
}

export async function editArticle(page: Page, locators: any, slug: string, updates: Partial<ArticleData>) {
  await page.goto(appPaths.editor(slug), { waitUntil: 'load' });

  // Wait for the API data to populate the form (not just for the input to exist)
  const titleInput = locators.editor.titleInput().raw;
  await expect(titleInput).not.toHaveValue('', { timeout: 10000 });

  if (updates.title) {
    await locators.editor.titleInput().fill('');
    await locators.editor.titleInput().fill(updates.title);
  }
  if (updates.description) {
    await locators.editor.descriptionInput().fill('');
    await locators.editor.descriptionInput().fill(updates.description);
  }
  if (updates.body) {
    await locators.editor.bodyInput().fill('');
    await locators.editor.bodyInput().fill(updates.body);
  }

  await Promise.all([page.waitForURL(/\/article\/.+/), locators.editor.publishButton().click()]);
}

export async function deleteArticle(page: Page, locators: any) {
  // Assumes we're already on the article page
  await Promise.all([page.waitForURL(url => url.toString().endsWith(appPaths.home())), locators.article.deleteButton().click()]);
}

export async function favoriteArticle(page: Page, locators: any) {
  await locators.article.favoriteButton().click();
  // Wait for the button to update to "Unfavorite"
  await expect(locators.article.unfavoriteButton().raw.first()).toBeVisible();
}

export async function unfavoriteArticle(page: Page, locators: any) {
  await locators.article.unfavoriteButton().click();
  // Wait for the button to update back to "Favorite"
  await expect(locators.article.favoriteButton().raw.first()).toBeVisible();
}

export function generateUniqueArticle(): ArticleData {
  const timestamp = Date.now();
  return {
    title: `Test Article ${timestamp}`,
    description: `Description for test article ${timestamp}`,
    body: `This is the body content for test article created at ${timestamp}. It contains enough text to be meaningful.`,
    tags: ['test', 'playwright'],
  };
}
