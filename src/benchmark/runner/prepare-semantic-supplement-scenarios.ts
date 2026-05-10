import { execSync } from 'child_process';
import {
  getAppScenariosPath,
  getSelectedAppId,
} from '../../apps';
import {
  REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
} from '../realworld-corpus';

function getNpmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function getShellCommand(): string | undefined {
  if (process.platform === 'win32') {
    return process.env.ComSpec || 'cmd.exe';
  }
  return undefined;
}

function runNpmScript(script: string, env: NodeJS.ProcessEnv): void {
  execSync(`${getNpmCommand()} run ${script}`, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env,
    shell: getShellCommand(),
  });
}

async function main() {
  const appName = (process.argv[2] || process.env.APP_ID || process.env.npm_config_appid || getSelectedAppId()) as any;
  const requestedBudget = parseInt(process.argv[3] || process.env.BENCHMARK_BUDGET || process.env.npm_config_budget || '20', 10);
  const seed = parseInt(process.argv[4] || process.env.BENCHMARK_SEED || process.env.npm_config_seed || '12345', 10);
  const preflightTimeoutMs = parseInt(process.argv[5] || process.env.PREFLIGHT_TEST_TIMEOUT_MS || '60000', 10);

  const sharedEnv = {
    ...process.env,
    APP_ID: String(appName),
    BENCHMARK_CORPUS_ID: REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
    BENCHMARK_BUDGET: String(requestedBudget),
    BENCHMARK_SEED: String(seed),
    PREFLIGHT_TEST_TIMEOUT_MS: String(preflightTimeoutMs),
  };

  runNpmScript('benchmark:semantic:collect:app', sharedEnv);
  runNpmScript('benchmark:semantic:generate:app', sharedEnv);
  runNpmScript('benchmark:semantic:preflight:app', sharedEnv);
  runNpmScript('benchmark:semantic:finalize:app', sharedEnv);

  const scenarioPath = getAppScenariosPath(appName as any);
  console.log(`Semantic supplement scenario preparation complete for ${appName}. Final scenario file: ${scenarioPath}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
