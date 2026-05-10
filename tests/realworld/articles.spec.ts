import { test, expect } from '../baseFixture';
import { register, generateUniqueUser } from './helpers/auth';
import {
  createArticle,
  editArticle,
  deleteArticle,
  favoriteArticle,
  unfavoriteArticle,
  generateUniqueArticle,
} from './helpers/articles';
import { API_MODE } from './helpers/config';
import { appPaths, pathRegex, bindAppLocators } from './helpers/app';

test.describe('Articles', () => {
  test.beforeEach(async ({ page, locators }) => {
    // Register and login before each test
    const user = generateUniqueUser();
    await register(page, locators, user.username, user.email, user.password);
  });

  test.afterEach(async ({ context }) => {
    // Close the browser context to ensure complete isolation between tests.
    // This releases browser instances, network connections, and other resources.
    await context.close();
    // Wait 500ms to allow async cleanup operations to complete.
    // Without this delay, running 6+ tests in sequence causes flaky failures
    // due to resource exhaustion (network connections, file descriptors, etc).
    // This timing issue manifests as timeouts when loading article pages.
    // This will be investigated and fixed later.
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  test('should create a new article', async ({ page, locators, oracle }) => {
    const article = generateUniqueArticle();

    await createArticle(page, locators, article);

    // Should be on article page
    await expect(page).toHaveURL(/\/article\/.+/);

    // Should show article content
    await expect(locators.article.title().raw).toHaveText(article.title);
    await expect(locators.article.body().raw).toContainText(article.body);

    // Should show tags
    for (const tag of article.tags || []) {
      await expect(locators.article.tag(tag).raw).toBeVisible();
    }
  });

  test('should edit an existing article', async ({ page, locators }) => {
    const article = generateUniqueArticle();

    await createArticle(page, locators, article);

    // Get the article slug from URL
    const url = page.url();
    const slug = url.split('/article/')[1];

    // Edit the article
    const updates = {
      title: `Updated ${article.title}`,
      description: `Updated ${article.description}`,
    };

    await editArticle(page, locators, slug, updates);

    // Should show updated content
    await expect(locators.article.title().raw).toHaveText(updates.title);
  });

  test('should delete an article', async ({ page, locators }) => {
    const article = generateUniqueArticle();

    await createArticle(page, locators, article);

    // Delete the article
    await deleteArticle(page, locators);

    // Should be redirected to home
    await expect(page).toHaveURL(pathRegex(appPaths.home()));

    // Article should not appear on home page
    await expect(locators.home.articlePreview(article.title).raw).toHaveCount(0);
  });

  /**
   * Verifies the frontend handles HTTP 200 for article deletion.
   *
   * The RealWorld spec uses 204 No Content for DELETE operations, which is
   * semantically correct (success with no response body). However, HTTP clients
   * should accept ANY 2XX status as success per RFC 9110.
   *
   * This test mocks a 200 response to verify the frontend doesn't break when
   * an implementation returns 200 instead of 204. This is good engineering
   * practice: clients should handle status code classes, not specific codes.
   */
  test('should delete an article when server returns 200 instead of 204', async ({ page, locators }) => {
    test.skip(!API_MODE, 'API-only: tests client-side HTTP status code handling via page.route()');
    const article = generateUniqueArticle();

    await createArticle(page, locators, article);

    // Intercept DELETE requests and respond with 200 instead of 204
    await page.route('**/api/articles/*', async route => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({}),
        });
      } else {
        await route.continue();
      }
    });

    // Delete the article
    await deleteArticle(page, locators);

    // Should be redirected to home (frontend should handle 200 the same as 204)
    await expect(page).toHaveURL(pathRegex(appPaths.home()));
  });

  test('should favorite an article', async ({ page, locators }) => {
    // Use an existing article from the demo backend (can't favorite own articles)
    // Go to global feed to see all articles
    await page.goto(appPaths.home(), { waitUntil: 'load' });

    // Click on the first article to go to its detail page
    await locators.home.previewTitle(locators.home.firstArticlePreview().raw).click();
    await page.waitForLoadState('load');

    // Favorite the article using the helper (which expects to be on article detail page)
    await favoriteArticle(page, locators);

    // Should see unfavorite button (use .first() since there are 2 buttons on the page)
    await expect(locators.article.unfavoriteButton().raw.first()).toBeVisible();
  });

  test('should unfavorite an article', async ({ page, locators }) => {
    // Go to global feed to find an article from demo backend (not own article)
    await page.goto(appPaths.home(), { waitUntil: 'load' });

    // Wait for articles to load
    await expect(locators.home.firstArticlePreview().raw).toBeVisible({ timeout: 10000 });

    // A freshly registered user has no published articles, so the first feed item
    // is sufficient for this cross-app favorite/unfavorite flow.
    await locators.home.previewTitle(locators.home.firstArticlePreview().raw).click();
    await page.waitForURL(/\/article\/.+/);

    // Wait for article page to load - should see Favorite button (not Delete button)
    await expect(locators.article.favoriteButton().raw).toBeVisible({ timeout: 10000 });

    // Favorite it first
    await favoriteArticle(page, locators);

    // Then unfavorite it
    await unfavoriteArticle(page, locators);

    // Should see favorite button again (use .first() since there are 2 buttons on the page)
    await expect(locators.article.favoriteButton().raw.first()).toBeVisible();
  });

  test('should view article from home feed', async ({ page, locators }) => {
    const article = generateUniqueArticle();

    await createArticle(page, locators, article);

    // Go to global feed to see the article we just created
    await page.goto(appPaths.home(), { waitUntil: 'load' });

    // Wait for articles to load
    await expect(locators.home.firstArticlePreview().raw).toBeVisible({ timeout: 10000 });

    // Wait for our specific article to appear
    await expect(locators.home.articlePreview(article.title).raw).toBeVisible({ timeout: 10000 });

    // Click on the article link in the feed (h1 is inside a link)
    await Promise.all([
      page.waitForURL(/\/article\/.+/),
      locators.home.previewTitle(locators.home.articlePreview(article.title).raw).click(),
    ]);

    // Should be on article page
    await expect(page).toHaveURL(/\/article\/.+/);
    await expect(locators.article.title().raw).toHaveText(article.title);
  });

  test('should display article preview correctly', async ({ page, locators }) => {
    const article = generateUniqueArticle();

    await createArticle(page, locators, article);

    // Go to global feed to see the article we just created
    await page.goto(appPaths.home());

    // Article preview should show correct information
    const preview = locators.home.firstArticlePreview().raw;
    await expect(locators.home.previewTitle(preview).raw).toHaveText(article.title);
    await expect(locators.home.previewDescription(preview).raw).toContainText(article.description);

    // Should show author info
    await expect(locators.home.previewAuthor(preview).raw).toBeVisible();

    // Should show tags
    for (const tag of article.tags || []) {
      await expect(locators.home.previewTag(preview, tag).raw).toBeVisible();
    }
  });

  test('should remove all tags when editing an article', async ({ page, locators }) => {
    const article = generateUniqueArticle();

    await createArticle(page, locators, article);

    // Should show tags on the article page
    for (const tag of article.tags || []) {
      await expect(locators.article.tag(tag).raw).toBeVisible();
    }

    // Get the article slug from URL
    const slug = page.url().split('/article/')[1];

    // Go to the editor
    await page.goto(`/editor/${slug}`, { waitUntil: 'load' });

    // Wait for the form to be populated
    const titleInput = locators.editor.titleInput().raw;
    await expect(titleInput).not.toHaveValue('', { timeout: 10000 });

    // Remove all tag pills by clicking their delete icons
    while (await locators.editor.tagRemoveButtons().raw.count() > 0) {
      await locators.editor.tagRemoveButtons().raw.first().click();
      await page.waitForTimeout(100);
    }

    // Intercept the PUT request to verify tagList is sent as [] (SPA-only: fullstack doesn't use fetch)
    let capturedTagList: unknown = undefined;
    if (API_MODE) {
      await page.route('**/api/articles/*', async route => {
        if (route.request().method() === 'PUT') {
          const body = route.request().postDataJSON();
          capturedTagList = body?.article?.tagList;
          await route.continue();
        } else {
          await route.continue();
        }
      });
    }

    // Publish
    await Promise.all([page.waitForURL(/\/article\/.+/), locators.editor.publishButton().click()]);

    // Verify the frontend sent tagList: [] (not undefined/omitted) — SPA only
    if (API_MODE) {
      expect(capturedTagList).toEqual([]);
    }

    // Verify no tags on the article page
    await expect(locators.article.tagList().raw.locator('.tag-default, .tag-pill')).toHaveCount(0);
  });

  test('should only allow author to edit/delete article', async ({ page, browser, locators }) => {
    const article = generateUniqueArticle();

    // Create article as first user
    await createArticle(page, locators, article);

    // Get article URL
    const articleUrl = page.url();

    // Create a second user in new context (not sharing cookies with first user)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const user2 = generateUniqueUser();
    const page2Locators = bindAppLocators(page2);
    await register(page2, page2Locators, user2.username, user2.email, user2.password);

    // Visit the article as second user
    await page2.goto(articleUrl);

    // Should not see Edit/Delete buttons
    await expect(page2Locators.article.editButton().raw).not.toBeVisible();
    await expect(page2Locators.article.deleteButton().raw).not.toBeVisible();

    await context2.close();
  });
});
