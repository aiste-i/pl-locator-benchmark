import { defineConfig, devices } from '@playwright/test';
import { getSelectedAppAdapter } from './src/apps';

const adapter = getSelectedAppAdapter();
const enableWebServer = process.env.SKIP_WEB_SERVER !== '1';
const webServerEnv = Object.fromEntries(
  Object.entries({
    ...process.env,
    ...(adapter.env ?? {}),
  }).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
);
const requestedBrowsers = (process.env.PLAYWRIGHT_BROWSERS || 'chromium')
  .split(',')
  .map(value => value.trim().toLowerCase())
  .filter(Boolean);

const browserProjects = requestedBrowsers.map(browserName => {
  const deviceName =
    browserName === 'firefox'
      ? 'Desktop Firefox'
      : browserName === 'webkit'
        ? 'Desktop Safari'
        : 'Desktop Chrome';

  return {
    name: `${adapter.id}-${browserName}`,
    metadata: {
      appId: adapter.id,
      appDisplayName: adapter.displayName,
      browserName,
    },
    use: {
      ...devices[deviceName],
      browserName: browserName as 'chromium' | 'firefox' | 'webkit',
    },
  };
});

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  testMatch: adapter.testMatch,
  outputDir: `test-results/${adapter.id}/playwright-artifacts`,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    baseURL: adapter.baseURL,
    navigationTimeout: 15_000,
    actionTimeout: 10_000,
  },
  projects: browserProjects,
  webServer: enableWebServer
    ? {
        command: adapter.startCommand,
        cwd: adapter.rootDir,
        url: adapter.healthUrl,
        env: webServerEnv,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 180_000,
      }
    : undefined,
});
