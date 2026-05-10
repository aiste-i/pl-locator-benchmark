import { Page } from '@playwright/test';
import { API_MODE } from './config';
import { appPaths, bindAppLocators } from './app';

export async function followUser(page: Page, username: string): Promise<void>;
export async function followUser(page: Page, locators: any, username: string): Promise<void>;
export async function followUser(page: Page, arg2: any, arg3?: string): Promise<void> {
  const locators = typeof arg2 === 'string' ? bindAppLocators(page) : arg2;
  const username = typeof arg2 === 'string' ? arg2 : arg3!;
  await page.goto(appPaths.profile(username), { waitUntil: 'load' });
  // Wait for profile page to load and Follow button to appear
  await locators.profile.followButton().click();
  // Wait for button to update
  await locators.profile.unfollowButton().raw.waitFor({ timeout: 5000 });
}

export async function unfollowUser(page: Page, username: string): Promise<void>;
export async function unfollowUser(page: Page, locators: any, username: string): Promise<void>;
export async function unfollowUser(page: Page, arg2: any, arg3?: string): Promise<void> {
  const locators = typeof arg2 === 'string' ? bindAppLocators(page) : arg2;
  const username = typeof arg2 === 'string' ? arg2 : arg3!;
  await page.goto(appPaths.profile(username), { waitUntil: 'load' });
  // Wait for profile page to load and Unfollow button to appear
  await locators.profile.unfollowButton().click();
  // Wait for button to update
  await locators.profile.followButton().raw.waitFor({ timeout: 5000 });
}

interface ProfileUpdates {
  image?: string;
  username?: string;
  bio?: string;
  email?: string;
  password?: string;
}

export async function updateProfile(page: Page, updates: ProfileUpdates): Promise<void>;
export async function updateProfile(page: Page, locators: any, updates: ProfileUpdates): Promise<void>;
export async function updateProfile(page: Page, arg2: any, arg3?: ProfileUpdates): Promise<void> {
  const locators = isProfileUpdates(arg2) ? bindAppLocators(page) : arg2;
  const updates = (isProfileUpdates(arg2) ? arg2 : arg3)!;
  await page.goto(appPaths.settings(), { waitUntil: 'load' });

  if (updates.image !== undefined) {
    await locators.settings.imageInput().fill(updates.image);
  }
  if (updates.username) {
    await locators.settings.usernameInput().fill(updates.username);
  }
  if (updates.bio !== undefined) {
    await locators.settings.bioInput().fill(updates.bio);
  }
  if (updates.email) {
    await locators.settings.emailInput().fill(updates.email);
  }
  if (updates.password) {
    await locators.settings.passwordInput().fill(updates.password);
  }

  if (API_MODE) {
    // Click submit and wait for API call to complete, then navigation
    await Promise.all([
      page.waitForResponse(response => response.url().includes('/user') && response.request().method() === 'PUT'),
      page.waitForURL(url => !url.toString().includes('/settings')),
      locators.settings.submitButton().click(),
    ]);
  } else {
    // Click submit and wait for navigation away from settings
    await Promise.all([
      page.waitForURL(url => !url.toString().includes('/settings')),
      locators.settings.submitButton().click(),
    ]);
  }
}

function isProfileUpdates(value: unknown): value is ProfileUpdates {
  return Boolean(value && typeof value === 'object' && !('settings' in (value as Record<string, unknown>)));
}
