import * as fs from 'fs';
import * as path from 'path';
import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

export interface ValidationFailure {
  filePath: string;
  jsonPath: string;
  message: string;
}

export interface FileValidationResult {
  filePath: string;
  valid: boolean;
  errors: ValidationFailure[];
}

let cachedValidator: ValidateFunction | null = null;

export function getBenchmarkResultsSchemaPath(): string {
  return path.join(process.cwd(), 'schemas', 'benchmark-results.schema.json');
}

function getValidator(): ValidateFunction {
  if (cachedValidator) {
    return cachedValidator;
  }

  const schema = JSON.parse(fs.readFileSync(getBenchmarkResultsSchemaPath(), 'utf8'));
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
  });
  addFormats(ajv, { mode: 'fast' });
  cachedValidator = ajv.compile(schema);
  return cachedValidator;
}

function normalizeJsonPath(error: ErrorObject): string {
  const pathValue = error.instancePath || '';
  if (pathValue === '') {
    return '$';
  }
  return `$${pathValue.startsWith('/') ? pathValue.replace(/\//g, '.') : pathValue}`;
}

export function validateBenchmarkPayload(payload: unknown, filePath = '<memory>'): FileValidationResult {
  const validate = getValidator();
  const valid = Boolean(validate(payload));
  const errors = (validate.errors ?? []).map(error => ({
    filePath,
    jsonPath: normalizeJsonPath(error),
    message: error.message ?? 'schema validation failed',
  }));

  return { filePath, valid, errors };
}

function getAllJsonFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }

  return files;
}

function isBenchmarkResultCandidate(filePath: string): boolean {
  const normalized = filePath.split(path.sep).join('/');
  const baseName = path.basename(filePath);
  if (normalized.includes('/benchmark-runs/') && baseName.endsWith('.json') && !baseName.endsWith('_axe.json')) {
    return true;
  }
  if (normalized.includes('/artifacts/') && baseName === 'results.json') {
    return true;
  }
  return baseName === 'results.json';
}

export function collectBenchmarkResultFiles(inputPath: string): string[] {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Path does not exist: ${resolved}`);
  }

  const stat = fs.statSync(resolved);
  if (stat.isFile()) {
    return [resolved];
  }

  return getAllJsonFiles(resolved).filter(isBenchmarkResultCandidate).sort();
}

export function validateBenchmarkResultFile(filePath: string): FileValidationResult {
  try {
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return validateBenchmarkPayload(payload, filePath);
  } catch (error: any) {
    return {
      filePath,
      valid: false,
      errors: [{
        filePath,
        jsonPath: '$',
        message: `could not parse JSON: ${error.message}`,
      }],
    };
  }
}

export function validateBenchmarkResultPaths(inputPaths: string[]): FileValidationResult[] {
  const files = inputPaths.flatMap(collectBenchmarkResultFiles);
  return files.map(validateBenchmarkResultFile);
}
