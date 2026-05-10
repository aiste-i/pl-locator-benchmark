import path from 'path';
import { angularRealWorldAdapter } from './angular-realworld-example-app.adapter';
import { realworldAdapter } from './realworld.adapter';
import { vue3RealWorldAdapter } from './vue3-realworld-example-app.adapter';
import { AppAdapter, SupportedAppId } from './types';
import { getBenchmarkCorpusId } from '../benchmark/realworld-corpus';

export const APP_REGISTRY: Record<SupportedAppId, AppAdapter> = {
  'angular-realworld-example-app': angularRealWorldAdapter,
  realworld: realworldAdapter,
  'vue3-realworld-example-app': vue3RealWorldAdapter,
};

export const REALWORLD_APP_IDS: SupportedAppId[] = [
  'angular-realworld-example-app',
  'realworld',
  'vue3-realworld-example-app',
];

export function getSelectedAppId(): SupportedAppId {
  const candidate = (process.env.APP_ID || process.env.npm_config_appid) as SupportedAppId | undefined;
  if (!candidate) {
    return 'angular-realworld-example-app';
  }
  if (!(candidate in APP_REGISTRY)) {
    throw new Error(`Unsupported APP_ID "${candidate}". Expected one of: ${Object.keys(APP_REGISTRY).join(', ')}`);
  }
  return candidate;
}

export function getSelectedAppAdapter(): AppAdapter {
  return APP_REGISTRY[getSelectedAppId()];
}

export function getAppAdapter(appId: SupportedAppId): AppAdapter {
  const adapter = APP_REGISTRY[appId];
  if (!adapter) {
    throw new Error(`Unknown application "${appId}"`);
  }
  return adapter;
}

export function getAppResultsDir(appId: SupportedAppId): string {
  const corpusId = getBenchmarkCorpusId();
  return corpusId
    ? path.join(process.cwd(), 'test-results', appId, corpusId)
    : path.join(process.cwd(), 'test-results', appId);
}

export function getAppScenariosPath(appId: SupportedAppId): string {
  return path.join(getAppResultsDir(appId), 'scenarios.json');
}

export function getAppReachableTargetsPath(appId: SupportedAppId): string {
  return path.join(getAppResultsDir(appId), 'reachable-targets.json');
}

export function getAppPreflightPoolPath(appId: SupportedAppId): string {
  return path.join(getAppResultsDir(appId), 'scenario-preflight-pool.json');
}

export function getAppPreflightResultsPath(appId: SupportedAppId): string {
  return path.join(getAppResultsDir(appId), 'scenario-preflight-results.json');
}
