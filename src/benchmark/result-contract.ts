import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import type { SupportedAppId } from '../apps/types';
import {
  REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
  getActiveScenarioIds,
  getSemanticSupplementScenarioEntries,
} from './realworld-corpus';

export const BENCHMARK_SCHEMA_VERSION = '1.0.0';
export const BENCHMARK_DATASET_VERSION = '2026.04';

export type BenchmarkBrowserName = 'chromium' | 'firefox' | 'webkit';
export type BenchmarkExecutionMode = 'baseline' | 'mutate-sample' | 'mutate-full' | 'aggregate';

export interface BenchmarkPlatformInfo {
  os: string;
  platform: NodeJS.Platform;
  release: string;
  arch: NodeJS.Architecture;
}

export interface BenchmarkCiContext {
  workflowName: string | null;
  runNumber: string | null;
  runnerOs: string | null;
}

export interface RunMetadataInput {
  runId: string;
  generatedAt: string;
  applicationId: string;
  browserName: string;
  browserChannel?: string | null;
  corpusId?: string;
  selectedScenarios?: string[];
  selectedApps?: SupportedAppId[] | string[];
  seed?: number | null;
  mutationBudget?: number | null;
  selectedMutationIds?: string[];
  totalCandidatesConsidered?: number | null;
  executionMode: BenchmarkExecutionMode;
  browserSetUsed?: string[];
}

export interface BenchmarkRunMetadata {
  schemaVersion: string;
  datasetVersion: string;
  runId: string;
  generatedAt: string;
  commitSha: string;
  gitBranch: string | null;
  dirtyWorkingTree: boolean | null;
  nodeVersion: string;
  npmVersion: string | null;
  playwrightVersion: string;
  benchmarkPackageVersion: string | null;
  platform: BenchmarkPlatformInfo;
  browserSetUsed: string[];
  browserChannel: string | null;
  benchmarkScope: string | null;
  corpusId: string | null;
  selectedScenarios: string[];
  selectedApps: string[];
  seed: number | null;
  mutationBudget: number | null;
  selectedMutationIds: string[];
  totalCandidatesConsidered: number | null;
  executionMode: BenchmarkExecutionMode;
  ci: BenchmarkCiContext;
}

let cachedStaticMetadata: Omit<
  BenchmarkRunMetadata,
  | 'runId'
  | 'generatedAt'
  | 'browserSetUsed'
  | 'browserChannel'
  | 'benchmarkScope'
  | 'corpusId'
  | 'selectedScenarios'
  | 'selectedApps'
  | 'seed'
  | 'mutationBudget'
  | 'selectedMutationIds'
  | 'totalCandidatesConsidered'
  | 'executionMode'
> | null = null;

function readCommand(command: string, args: string[]): string | null {
  try {
    return execFileSync(command, args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch {
    return null;
  }
}

function getBenchmarkPackageVersion(): string | null {
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return typeof packageJson.version === 'string' ? packageJson.version : null;
  } catch {
    return null;
  }
}

function getPlaywrightVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const packageJson = require('@playwright/test/package.json');
    return packageJson.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

function getNpmVersion(): string | null {
  return readCommand(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version']);
}

function getGitDirtyState(): boolean | null {
  const status = readCommand('git', ['status', '--porcelain']);
  return status === null ? null : status.length > 0;
}

function getStaticMetadata() {
  if (cachedStaticMetadata) {
    return cachedStaticMetadata;
  }

  cachedStaticMetadata = {
    schemaVersion: BENCHMARK_SCHEMA_VERSION,
    datasetVersion: BENCHMARK_DATASET_VERSION,
    commitSha: readCommand('git', ['rev-parse', 'HEAD']) ?? 'unknown',
    gitBranch: readCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD']),
    dirtyWorkingTree: getGitDirtyState(),
    nodeVersion: process.version,
    npmVersion: getNpmVersion(),
    playwrightVersion: getPlaywrightVersion(),
    benchmarkPackageVersion: getBenchmarkPackageVersion(),
    platform: {
      os: os.type(),
      platform: process.platform,
      release: os.release(),
      arch: process.arch,
    },
    ci: {
      workflowName: process.env.GITHUB_WORKFLOW ?? null,
      runNumber: process.env.GITHUB_RUN_NUMBER ?? null,
      runnerOs: process.env.RUNNER_OS ?? null,
    },
  };

  return cachedStaticMetadata;
}

export function getRequestedBrowserSet(): string[] {
  return (process.env.PLAYWRIGHT_BROWSERS || 'chromium')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

export function inferExecutionMode(phase: 'baseline' | 'mutated'): BenchmarkExecutionMode {
  if (phase === 'baseline') {
    return 'baseline';
  }

  const mutationLimit = process.env.MUTATION_LIMIT || process.env.npm_config_limit;
  if (mutationLimit && Number(mutationLimit) > 0) {
    return 'mutate-sample';
  }

  return 'mutate-full';
}

export function createRunMetadata(input: RunMetadataInput): BenchmarkRunMetadata {
  const staticMetadata = getStaticMetadata();
  const defaultSelectedScenarios =
    input.corpusId === REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID
      ? getSemanticSupplementScenarioEntries().map(entry => entry.scenarioId)
      : getActiveScenarioIds();
  return {
    ...staticMetadata,
    runId: input.runId,
    generatedAt: input.generatedAt,
    browserSetUsed: input.browserSetUsed ?? getRequestedBrowserSet(),
    browserChannel: input.browserChannel ?? null,
    benchmarkScope: input.corpusId ?? null,
    corpusId: input.corpusId ?? null,
    selectedScenarios: input.selectedScenarios ?? defaultSelectedScenarios,
    selectedApps: input.selectedApps ?? [input.applicationId],
    seed: input.seed ?? null,
    mutationBudget: input.mutationBudget ?? null,
    selectedMutationIds: input.selectedMutationIds ?? [],
    totalCandidatesConsidered: input.totalCandidatesConsidered ?? null,
    executionMode: input.executionMode,
  };
}

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const text = Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function writeCsvRows(filePath: string, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    fs.writeFileSync(filePath, '');
    return;
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header])).join(',')),
  ];
  fs.writeFileSync(filePath, lines.join('\n'));
}

export function flattenResultForCsv(result: any): Record<string, unknown> {
  return {
    schemaVersion: result.schemaVersion,
    datasetVersion: result.datasetVersion,
    runId: result.runId,
    generatedAt: result.generatedAt,
    commitSha: result.commitSha,
    applicationId: result.applicationId,
    corpusId: result.corpusId ?? null,
    corpusRole: result.corpusRole ?? null,
    scenarioId: result.scenarioId,
    activeScenarioId: result.activeScenarioId ?? null,
    intendedSemanticEntryPoint: result.intendedSemanticEntryPoint ?? null,
    actualSemanticEntryPoint: result.actualSemanticEntryPoint ?? null,
    targetLogicalKeys: result.targetLogicalKeys ?? [],
    semanticScenarioSupportedApps: result.semanticScenarioSupportedApps ?? [],
    semanticScenarioExclusionReason: result.semanticScenarioExclusionReason ?? null,
    locatorFamily: result.locatorFamily,
    browserName: result.browserName,
    browserChannel: result.browserChannel ?? null,
    phase: result.phase,
    runStatus: result.runStatus,
    failureClass: result.failureClass ?? null,
    durationMs: result.durationMs,
    instrumentationPathUsed: result.instrumentationPathUsed,
    comparisonEligible: result.comparisonEligible,
    comparisonExclusionReason: result.comparisonExclusionReason ?? null,
    mutationId: result.mutation?.mutationId ?? null,
    operatorId: result.mutation?.operatorId ?? null,
    operatorCategory: result.mutation?.operatorCategory ?? null,
    candidateId: result.mutation?.candidateId ?? null,
    seed: result.mutation?.seed ?? null,
    mutationSelected: result.mutation?.selected ?? null,
    mutationApplied: result.mutation?.applied ?? null,
    mutationSkipped: result.mutation?.skipped ?? null,
    mutationSkipReason: result.mutation?.skipReason ?? null,
    accessibilityScanAttempted: result.accessibility?.scanAttempted ?? null,
    accessibilityScanStatus: result.accessibility?.scanStatus ?? null,
    accessibilityTotalViolations: result.accessibility?.totalViolations ?? null,
    accessibilityImpactedNodeCount: result.accessibility?.impactedNodeCount ?? null,
    accessibilityArtifactPath: result.accessibility?.artifactPath ?? null,
    tracePath: result.tracePath ?? null,
    screenshotPath: result.screenshotPath ?? null,
    axeArtifactPath: result.axeArtifactPath ?? null,
    ariaSnapshotPath: result.ariaSnapshotPath ?? null,
  };
}
