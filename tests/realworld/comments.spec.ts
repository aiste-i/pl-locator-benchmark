import { test, expect } from '../baseFixture';
import { register, generateUniqueUser } from './helpers/auth';
import { createArticle, generateUniqueArticle } from './helpers/articles';
import { addComment, deleteComment, getCommentCount } from './helpers/comments';
import { API_MODE } from './helpers/config';
import { appPaths, hrefSelector } from './helpers/app';

test.describe('Comments', () => {
  // Force each test to use a fresh browser context
  test.use({ storageState: undefined });

  test.beforeEach(async ({ page, locators }) => {
    // Register and login, then create an article
    const user = generateUniqueUser();
    await register(page, locators, user.username, user.email, user.password);
    const article = generateUniqueArticle();
    await createArticle(page, locators, article);
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

  test('should add a comment to an article', async ({ page, locators, oracle }) => {
    const commentText = 'This is a test comment from Playwright!';
    const commentId = await addComment(page, locators, oracle, commentText);
    await expect(oracle.comments.cardById(commentId).raw).toBeVisible();
  });

  test('should delete own comment', async ({ page, locators, oracle }) => {
    const commentText = 'Comment to be deleted';
    const commentId = await addComment(page, locators, oracle, commentText);
    await expect(oracle.comments.cardById(commentId).raw).toBeVisible();
    await deleteComment(locators, oracle, commentId);
    await expect(oracle.comments.cardById(commentId).raw).toHaveCount(0);
  });

  /**
   * Verifies the frontend handles HTTP 200 for comment deletion.
   *
   * The RealWorld spec uses 204 No Content for DELETE operations, which is
   * semantically correct (success with no response body). However, HTTP clients
   * should accept ANY 2XX status as success per RFC 9110.
   *
   * This test mocks a 200 response to verify the frontend doesn't break when
   * an implementation returns 200 instead of 204. This is good engineering
   * practice: clients should handle status code classes, not specific codes.
   */
  test('should delete comment when server returns 200 instead of 204', async ({ page, locators, oracle }) => {
    test.skip(!API_MODE, 'API-only: tests client-side HTTP status code handling via page.route()');
    const commentText = 'Comment to test 200 status';
    const commentId = await addComment(page, locators, oracle, commentText);
    await expect(oracle.comments.cardById(commentId).raw).toBeVisible();

    // Intercept DELETE requests to comments and respond with 200 instead of 204
    await page.route('**/api/articles/*/comments/*', async route => {
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

    await deleteComment(locators, oracle, commentId);
    await expect(oracle.comments.cardById(commentId).raw).toHaveCount(0);
  });

  test('should display multiple comments', async ({ page, locators, oracle }) => {
    const comment1 = 'First comment';
    const comment2 = 'Second comment';
    const comment3 = 'Third comment';
    const comment1Id = await addComment(page, locators, oracle, comment1);
    const comment2Id = await addComment(page, locators, oracle, comment2);
    const comment3Id = await addComment(page, locators, oracle, comment3);
    await expect(oracle.comments.cardById(comment1Id).raw).toBeVisible();
    await expect(oracle.comments.cardById(comment2Id).raw).toBeVisible();
    await expect(oracle.comments.cardById(comment3Id).raw).toBeVisible();
    const count = await getCommentCount(oracle);
    expect(count).toBe(3);
  });

  test('should require login to post comment', async ({ page, browser }) => {
    // Create a new context without authentication (not sharing cookies with page)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    // Visit the article and wait for navigation
    await page2.goto(page.url(), { waitUntil: 'load' });
    // Wait for Angular to complete auth check - either comment form OR sign in link appears
    await page2.waitForSelector(`textarea[placeholder="Write a comment..."], ${hrefSelector(appPaths.login())}`, { timeout: 10000 });
    // Should see sign in/sign up links instead of comment form
    await expect(page2.locator(hrefSelector(appPaths.login())).first()).toBeVisible();
    await expect(page2.locator('textarea[placeholder="Write a comment..."]')).not.toBeVisible();
    await context2.close();
  });

  test('should only allow comment author to delete', async ({ page, locators, oracle }) => {
    // Use an existing demo article from the backend (e.g., johndoe's article)
    // This avoids session isolation issues
    // Go to global feed to see all articles
    await page.goto(appPaths.home(), { waitUntil: 'load' });
    // Wait for article to be fully loaded and clickable
    await expect(locators.home.previewTitle(locators.home.firstArticlePreview().raw).raw).toBeVisible({ timeout: 15000 });
    // Click on first article from demo backend (likely has existing comments)
    await locators.home.previewTitle(locators.home.firstArticlePreview().raw).click();
    await page.waitForURL(/\/article\/.+/, { timeout: 10000 });
    // Check if there are any existing comments (from other users like johndoe)
    const existingCommentsCount = await locators.comments.list().raw.locator('.card:not(.comment-form)').count();
    // If there are existing comments, they should NOT have delete buttons (not our comments)
    if (existingCommentsCount > 0) {
      const firstExistingComment = locators.comments.list().raw.locator('.card:not(.comment-form)').first();
      await expect(firstExistingComment.locator('span.mod-options i.ion-trash-a')).not.toBeVisible();
    }
    // Now add our own comment
    const commentText = `Comment by logged in user ${Date.now()}`;
    const ownCommentId = await addComment(page, locators, oracle, commentText);
    const ownComment = oracle.comments.cardById(ownCommentId);
    await expect(locators.comments.deleteButton(ownComment).raw).toBeVisible();
  });

  test('should handle long comments', async ({ page, locators, oracle }) => {
    const longComment = 'This is a very long comment. '.repeat(50);
    const commentId = await addComment(page, locators, oracle, longComment);
    await expect(oracle.comments.cardById(commentId).raw).toBeVisible();
  });

  test('should preserve comments after page reload', async ({ page, locators, oracle }) => {
    const commentText = 'Persistent comment';
    const commentId = await addComment(page, locators, oracle, commentText);
    // Reload the page
    await page.reload();
    await expect(oracle.comments.cardById(commentId).raw).toBeVisible();
  });

  test('should clear comment form after posting', async ({ page, locators, oracle }) => {
    const commentText = 'Test comment';
    await addComment(page, locators, oracle, commentText);
    // Comment textarea should be empty
    await expect(locators.comments.textarea().raw).toHaveValue('');
  });
});
