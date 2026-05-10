import { Page } from '@playwright/test';
import { AppAdapter, BootstrapUser } from './types';
import { getAngularRealWorldLocators, getAngularRealWorldOracle } from '../locators/apps/angular-realworld.locators';
import { angularRealWorldPaths } from './angular-realworld-example-app.routes';

const ANGULAR_PORT = process.env.ANGULAR_REALWORLD_PORT || '4300';
const ANGULAR_BASE_URL = `http://127.0.0.1:${ANGULAR_PORT}`;

async function bootstrapAuthenticatedSession(page: Page, user: BootstrapUser): Promise<void> {
  await page.goto(ANGULAR_BASE_URL, { waitUntil: 'load' });
  await page.evaluate((token: string) => {
    window.localStorage.setItem('jwtToken', token);
  }, user.token);
  await page.reload({ waitUntil: 'load' });
}

export const angularRealWorldAdapter: AppAdapter = {
  id: 'angular-realworld-example-app',
  displayName: 'Angular RealWorld Example App',
  rootDir: 'apps/angular-realworld-example-app',
  startCommand: `npm run start -- --host 127.0.0.1 --port ${ANGULAR_PORT}`,
  baseURL: ANGULAR_BASE_URL,
  healthUrl: ANGULAR_BASE_URL,
  testMatch: [
    'tests/realworld/benchmark-active.spec.ts',
    'tests/realworld/benchmark-semantic-supplement.spec.ts',
    'tests/realworld-validation/**/*.spec.ts',
  ],
  paths: angularRealWorldPaths,
  getLocators: getAngularRealWorldLocators,
  getOracle: getAngularRealWorldOracle,
  bootstrapAuthenticatedSession,
};
