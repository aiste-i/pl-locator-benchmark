import { test, expect } from '@playwright/test';
import { APP_REGISTRY, REALWORLD_APP_IDS } from '../../src/apps';

test('realworld app registry exposes the three benchmark subjects', async () => {
  expect(REALWORLD_APP_IDS).toEqual([
    'angular-realworld-example-app',
    'realworld',
    'vue3-realworld-example-app',
  ]);

  for (const appId of REALWORLD_APP_IDS) {
    const adapter = APP_REGISTRY[appId];
    expect(adapter).toBeDefined();
    expect(adapter.baseURL).toMatch(/^http/);
    expect(adapter.startCommand.length).toBeGreaterThan(0);
    expect(adapter.testMatch.length).toBeGreaterThan(0);
  }
});
