import { Page } from '@playwright/test';
import { AppAdapter, BootstrapUser } from './types';
import { getReactRealWorldLocators, getReactRealWorldOracle } from '../locators/apps/react-realworld.locators';
import { realworldPaths } from './realworld.routes';

const REALWORLD_PORT = process.env.REALWORLD_PORT || '4301';
const REALWORLD_BASE_URL = `http://127.0.0.1:${REALWORLD_PORT}`;

async function bootstrapAuthenticatedSession(page: Page, user: BootstrapUser): Promise<void> {
  const cookieValue = Buffer.from(
    JSON.stringify({
      username: user.username,
      email: user.email,
      token: user.token,
      bio: user.bio ?? null,
      image: user.image ?? null,
    }),
    'utf8',
  ).toString('base64');

  await page.context().addCookies([
    {
      name: 'jwt',
      value: cookieValue,
      url: REALWORLD_BASE_URL,
    },
  ]);
  await page.goto(REALWORLD_BASE_URL, { waitUntil: 'load' });
}

export const realworldAdapter: AppAdapter = {
  id: 'realworld',
  displayName: 'Svelte RealWorld',
  rootDir: 'apps/realworld',
  startCommand: `npm run dev -- --host 127.0.0.1 --port ${REALWORLD_PORT}`,
  baseURL: REALWORLD_BASE_URL,
  healthUrl: REALWORLD_BASE_URL,
  testMatch: [
    'tests/realworld/benchmark-active.spec.ts',
    'tests/realworld/benchmark-semantic-supplement.spec.ts',
    'tests/realworld-validation/**/*.spec.ts',
  ],
  paths: realworldPaths,
  getLocators: getReactRealWorldLocators,
  getOracle: getReactRealWorldOracle,
  bootstrapAuthenticatedSession,
};
