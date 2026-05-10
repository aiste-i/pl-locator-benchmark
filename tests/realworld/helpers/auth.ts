import { Page, expect } from '@playwright/test';
import { appPaths, bindAppLocators, pathRegex } from './app';

export async function register(page: Page, username: string, email: string, password: string): Promise<void>;
export async function register(page: Page, locators: any, username: string, email: string, password: string): Promise<void>;
export async function register(page: Page, arg2: any, arg3: string, arg4: string, arg5?: string): Promise<void> {
  const locators = typeof arg2 === 'string' ? bindAppLocators(page) : arg2;
  const username = typeof arg2 === 'string' ? arg2 : arg3;
  const email = typeof arg2 === 'string' ? arg3 : arg4;
  const password = typeof arg2 === 'string' ? arg4 : arg5!;
  await page.goto(appPaths.register(), { waitUntil: 'load' });
  await locators.auth.usernameInput().fill(username);
  await locators.auth.emailInput().fill(email);
  await locators.auth.passwordInput().fill(password);

  // Wait for navigation to complete or error to appear
  try {
    await Promise.all([page.waitForURL(pathRegex(appPaths.home())), locators.auth.submitButton().click()]);
  } catch (error) {
    // If navigation fails, check for errors
    const errorMsg = await locators.auth.errorList().raw.textContent().catch(() => '');
    if (errorMsg) {
      throw new Error(`Registration failed: ${errorMsg}`);
    }
    throw error;
  }
}

export async function login(page: Page, email: string, password: string): Promise<void>;
export async function login(page: Page, locators: any, email: string, password: string): Promise<void>;
export async function login(page: Page, arg2: any, arg3: string, arg4?: string): Promise<void> {
  const locators = typeof arg2 === 'string' ? bindAppLocators(page) : arg2;
  const email = typeof arg2 === 'string' ? arg2 : arg3;
  const password = typeof arg2 === 'string' ? arg3 : arg4!;
  await page.goto(appPaths.login(), { waitUntil: 'load' });
  await locators.auth.emailInput().fill(email);
  await locators.auth.passwordInput().fill(password);

  // Wait for navigation to complete or error to appear
  try {
    await Promise.all([page.waitForURL(pathRegex(appPaths.home())), locators.auth.submitButton().click()]);
  } catch (error) {
    // If navigation fails, check for errors
    const errorMsg = await locators.auth.errorList().raw.textContent().catch(() => '');
    if (errorMsg) {
      throw new Error(`Login failed: ${errorMsg}`);
    }
    throw error;
  }
}

export async function logout(page: Page): Promise<void>;
export async function logout(page: Page, locators: any): Promise<void>;
export async function logout(page: Page, locators: any = bindAppLocators(page)): Promise<void> {
  await locators.nav.settingsLink().click();
  await Promise.all([page.waitForURL(pathRegex(appPaths.home())), locators.settings.logoutButton().click()]);
  await expect(locators.nav.loginLink().raw.first()).toBeVisible();
}

export function generateUniqueUser() {
  const timestamp = Date.now();
  return {
    username: `testuser${timestamp}`,
    email: `test${timestamp}@example.com`,
    password: 'password123',
  };
}
