import { test, expect } from '../baseFixture';
import { API_MODE } from './helpers/config';
import { appPaths, pathRegex } from './helpers/app';

test.describe('Health Checks', () => {
  test('app should load successfully', async ({ page, oracle }) => {
    await page.goto(appPaths.home());

    // Should see the app brand/logo
    await oracle.nav.brandLink().assertVisible({ timeout: 10000 });

    // Should see navigation
    await oracle.nav.navbar().assertVisible();
  });

  test('API should be accessible', async ({ request }) => {
    test.skip(!API_MODE, 'API-only: direct API endpoint check');
    const response = await request.get('https://api.realworld.show/api/tags');
    expect(response.ok()).toBeTruthy();
  });

  test('can navigate to login page', async ({ page, locators, oracle }) => {
    await page.goto(appPaths.login());

    // Should see login form
    await expect(locators.auth.title().raw).toContainText(/sign in/i, { timeout: 10000 });
    await oracle.auth.emailInput().assertVisible();
    await expect(page).toHaveURL(pathRegex(appPaths.login()));
  });

  test('can navigate to register page', async ({ page, locators, oracle }) => {
    await page.goto(appPaths.register());

    // Should see register form
    await expect(locators.auth.title().raw).toContainText(/sign up/i, { timeout: 10000 });
    await oracle.auth.usernameInput().assertVisible();
    await expect(page).toHaveURL(pathRegex(appPaths.register()));
  });
});
