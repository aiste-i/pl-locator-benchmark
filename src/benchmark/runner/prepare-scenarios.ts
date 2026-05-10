import { execSync } from 'child_process';
import {
  getAppScenariosPath,
  getSelectedAppId,
} from '../../apps';

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
  const budget = parseInt(process.argv[3] || process.env.BENCHMARK_BUDGET || process.env.npm_config_budget || '20', 10);
  const seed = parseInt(process.argv[4] || process.env.BENCHMARK_SEED || process.env.npm_config_seed || '12345', 10);
  const preflightTimeoutMs = parseInt(process.argv[5] || process.env.PREFLIGHT_TEST_TIMEOUT_MS || '60000', 10);

  const sharedEnv = {
    ...process.env,
    APP_ID: String(appName),
    BENCHMARK_BUDGET: String(budget),
    BENCHMARK_SEED: String(seed),
    PREFLIGHT_TEST_TIMEOUT_MS: String(preflightTimeoutMs),
  };

  runNpmScript('benchmark:collect:app', sharedEnv);
  runNpmScript('benchmark:generate:app', sharedEnv);
  runNpmScript('benchmark:preflight:app', sharedEnv);
  runNpmScript('benchmark:finalize:app', sharedEnv);

  const scenarioPath = getAppScenariosPath(appName as any);
  console.log(`Validated scenario preparation complete for ${appName}. Final scenario file: ${scenarioPath}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
