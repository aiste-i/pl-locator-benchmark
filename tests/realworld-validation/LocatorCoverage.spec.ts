import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { REALWORLD_APP_IDS } from '../../src/apps';
import { getActiveLogicalKeys, getActiveScenarioEntries } from '../../src/benchmark/realworld-corpus';

test('unsupported coverage report is machine-readable', async () => {
  const reportPath = path.join(process.cwd(), 'reports', 'realworld-locator-unsupported.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  expect(Array.isArray(report)).toBe(true);
});

test('support matrix report is generated and carries source-kind metadata', async () => {
  const reportPath = path.join(process.cwd(), 'reports', 'realworld-locator-support-matrix.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as Array<{
    family: string;
    sourceKind: string | null;
    supported: boolean;
  }>;
  expect(Array.isArray(report)).toBe(true);
  expect(report.length).toBeGreaterThan(0);
  expect(report.some(row => row.family === 'oracle' && row.sourceKind === 'oracle')).toBe(true);
  expect(report.some(row => row.family === 'semantic-first' && row.supported)).toBe(true);
});

test('semantic css exception report is generated and stays separate from unsupported rows', async () => {
  const exceptionPath = path.join(process.cwd(), 'reports', 'realworld-semantic-css-exceptions.json');
  const unsupportedPath = path.join(process.cwd(), 'reports', 'realworld-locator-unsupported.json');
  const exceptions = JSON.parse(fs.readFileSync(exceptionPath, 'utf8')) as Array<{
    appId: string;
    logicalKey: string;
    reason: string;
    cssSelector: string;
    activeInCorpus: boolean;
  }>;
  const unsupported = JSON.parse(fs.readFileSync(unsupportedPath, 'utf8')) as Array<{
    app: string;
    logicalKey: string;
    family: string;
  }>;

  expect(Array.isArray(exceptions)).toBe(true);
  for (const row of exceptions) {
    expect(typeof row.appId).toBe('string');
    expect(typeof row.logicalKey).toBe('string');
    expect(typeof row.reason).toBe('string');
    expect(typeof row.cssSelector).toBe('string');
    const duplicateUnsupported = unsupported.some(
      candidate =>
        candidate.app === row.appId &&
        candidate.logicalKey === row.logicalKey &&
        candidate.family === 'semantic-first',
    );
    expect(duplicateUnsupported).toBe(false);
  }
});

test('every active logical key has support rows for all apps and families, including oracle', async () => {
  const reportPath = path.join(process.cwd(), 'reports', 'realworld-locator-support-matrix.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as Array<{
    app: string;
    logicalKey: string;
    family: string;
    activeInCorpus: boolean;
    activeScenarioIds: string[];
    supported: boolean;
    sourceKind: string | null;
  }>;
  const activeKeys = new Set(getActiveLogicalKeys());
  const activeScenarioIds = new Set(getActiveScenarioEntries().map(entry => entry.scenarioId));
  const expectedFamilies = new Set(['semantic-first', 'css', 'xpath', 'oracle']);

  for (const logicalKey of activeKeys) {
    const rows = report.filter(row => row.logicalKey === logicalKey);
    expect(rows.length, `${logicalKey} is missing support rows`).toBe(REALWORLD_APP_IDS.length * expectedFamilies.size);
    expect(rows.every(row => row.activeInCorpus), `${logicalKey} should be marked activeInCorpus`).toBe(true);
    expect(rows.every(row => row.supported), `${logicalKey} should be supported for every app and family`).toBe(true);
    expect([...new Set(rows.map(row => row.family))].sort()).toEqual([...expectedFamilies].sort());
    expect(rows.every(row => row.sourceKind !== null), `${logicalKey} should expose sourceKind metadata`).toBe(true);
    for (const scenarioId of activeScenarioIds) {
      const appearsInAnyRow =
        rows.some(row => row.activeScenarioIds.includes(scenarioId)) ||
        !getActiveScenarioEntries().some(entry => entry.scenarioId === scenarioId && entry.logicalKeys.includes(logicalKey as any));
      expect(appearsInAnyRow, `${logicalKey} is missing activeScenarioIds coverage for ${scenarioId}`).toBe(true);
    }
  }
});
