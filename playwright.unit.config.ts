import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/unit',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  outputDir: 'artifacts/playwright-unit',
  use: {
    ...devices['Desktop Chrome'],
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1',
    trace: 'off',
    screenshot: 'off',
  },
});
