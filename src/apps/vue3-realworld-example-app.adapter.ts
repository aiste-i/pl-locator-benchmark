import { Page } from '@playwright/test';
import { AppAdapter, BootstrapUser } from './types';
import { getVue3RealWorldLocators, getVue3RealWorldOracle } from '../locators/apps/vue3-realworld.locators';
import { vue3RealWorldPaths } from './vue3-realworld-example-app.routes';

const VUE3_PORT = process.env.VUE3_REALWORLD_PORT || '4302';
const VUE3_BASE_URL = `http://127.0.0.1:${VUE3_PORT}`;

async function bootstrapAuthenticatedSession(page: Page, user: BootstrapUser): Promise<void> {
  await page.goto(VUE3_BASE_URL, { waitUntil: 'load' });
  await page.evaluate((currentUser: BootstrapUser) => {
    window.localStorage.setItem('user', JSON.stringify(currentUser));
  }, user);
  await page.reload({ waitUntil: 'load' });
}

export const vue3RealWorldAdapter: AppAdapter = {
  id: 'vue3-realworld-example-app',
  displayName: 'Vue 3 RealWorld Example App',
  rootDir: 'apps/vue3-realworld-example-app',
  startCommand: `npm run dev -- --host 127.0.0.1 --port ${VUE3_PORT} --strictPort`,
  baseURL: VUE3_BASE_URL,
  healthUrl: VUE3_BASE_URL,
  testMatch: [
    'tests/realworld/benchmark-active.spec.ts',
    'tests/realworld/benchmark-semantic-supplement.spec.ts',
    'tests/realworld-validation/**/*.spec.ts',
  ],
  env: {
    VITE_API_HOST: 'https://api.realworld.show',
  },
  paths: vue3RealWorldPaths,
  getLocators: getVue3RealWorldLocators,
  getOracle: getVue3RealWorldOracle,
  bootstrapAuthenticatedSession,
};
