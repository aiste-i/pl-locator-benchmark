import * as path from 'path';
import {
  collectBenchmarkResultFiles,
  validateBenchmarkResultFile,
} from '../src/benchmark/result-schema-validator';

function printUsage(): void {
  console.log('Usage: npm run validate:results -- [file-or-directory ...]');
  console.log('If no path is provided, test-results and artifacts are scanned when present.');
}

function defaultInputs(): string[] {
  return ['test-results', 'artifacts'].filter(candidate => {
    try {
      return require('fs').existsSync(path.resolve(candidate));
    } catch {
      return false;
    }
  });
}

function main(): void {
  const args = process.argv.slice(2).filter(arg => arg !== '--');
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  const inputs = args.length > 0 ? args : defaultInputs();
  if (inputs.length === 0) {
    console.error('No result paths provided and no default result directories exist.');
    printUsage();
    process.exit(1);
  }

  const files = inputs.flatMap(input => collectBenchmarkResultFiles(input));
  if (files.length === 0) {
    console.error(`No benchmark result files found in: ${inputs.join(', ')}`);
    process.exit(1);
  }

  const results = files.map(validateBenchmarkResultFile);
  const failures = results.flatMap(result => result.errors);

  if (failures.length > 0) {
    console.error(`Benchmark result validation failed for ${new Set(failures.map(error => error.filePath)).size} file(s):`);
    for (const failure of failures) {
      console.error(`- ${path.relative(process.cwd(), failure.filePath)} ${failure.jsonPath}: ${failure.message}`);
    }
    process.exit(1);
  }

  console.log(`Validated ${results.length} benchmark result file(s).`);
}

try {
  main();
} catch (error: any) {
  console.error(error.message);
  process.exit(1);
}
