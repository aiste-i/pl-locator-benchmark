import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getBenchmarkRetention, pruneCompactBenchmarkArtifacts } from '../../src/benchmark/retention';

test('retention defaults to full and accepts compact explicitly', () => {
  const originalRetention = process.env.BENCHMARK_RETENTION;
  try {
    delete process.env.BENCHMARK_RETENTION;

    expect(getBenchmarkRetention()).toBe('full');
    expect(getBenchmarkRetention('compact')).toBe('compact');
    expect(getBenchmarkRetention('unexpected')).toBe('full');
  } finally {
    if (originalRetention === undefined) {
      delete process.env.BENCHMARK_RETENTION;
    } else {
      process.env.BENCHMARK_RETENTION = originalRetention;
    }
  }
});

test('compact retention preserves aggregate outputs while pruning raw artifacts', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'benchmark-retention-'));
  const inputDir = path.join(rootDir, 'benchmark-runs');
  const aggregateDir = path.join(rootDir, 'aggregate');
  const accessibilityDir = path.join(rootDir, 'accessibility-artifacts');

  fs.mkdirSync(inputDir, { recursive: true });
  fs.mkdirSync(aggregateDir, { recursive: true });
  fs.mkdirSync(accessibilityDir, { recursive: true });

  fs.writeFileSync(path.join(inputDir, 'run.json'), '{"runId":"1"}');
  fs.writeFileSync(path.join(accessibilityDir, 'scan.json'), '{"scan":"1"}');
  fs.writeFileSync(path.join(aggregateDir, 'aggregate_report.json'), '{"status":"kept"}');
  fs.writeFileSync(path.join(aggregateDir, 'accessibility_summary_completed_only.csv'), 'family,completedMutatedScans\ncss,1\n');

  const cleanup = pruneCompactBenchmarkArtifacts({
    inputDir,
    outputDir: aggregateDir,
    additionalDirs: [accessibilityDir],
    retention: 'compact',
  });

  expect(cleanup.removedPaths.sort()).toEqual([accessibilityDir, inputDir].sort());
  expect(fs.existsSync(inputDir)).toBeFalsy();
  expect(fs.existsSync(accessibilityDir)).toBeFalsy();
  expect(fs.existsSync(path.join(aggregateDir, 'aggregate_report.json'))).toBeTruthy();
  expect(fs.existsSync(path.join(aggregateDir, 'accessibility_summary_completed_only.csv'))).toBeTruthy();

  fs.rmSync(rootDir, { recursive: true, force: true });
});
