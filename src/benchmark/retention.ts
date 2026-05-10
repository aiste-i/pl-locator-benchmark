import * as fs from 'fs';
import * as path from 'path';

export type BenchmarkRetention = 'full' | 'compact';

export interface CompactRetentionCleanupOptions {
  inputDir: string;
  outputDir: string;
  additionalDirs?: string[];
  retention?: BenchmarkRetention;
}

export interface CompactRetentionCleanupSummary {
  retention: BenchmarkRetention;
  removedPaths: string[];
}

export function getBenchmarkRetention(rawValue: string | undefined = process.env.BENCHMARK_RETENTION): BenchmarkRetention {
  return rawValue === 'compact' ? 'compact' : 'full';
}

export function shouldWriteMirroredRunArtifacts(
  retention: BenchmarkRetention = getBenchmarkRetention(),
): boolean {
  return retention === 'full';
}

export function shouldWriteDetailedAccessibilityArtifacts(
  retention: BenchmarkRetention = getBenchmarkRetention(),
): boolean {
  return retention === 'full';
}

function isSamePath(left: string, right: string): boolean {
  return path.resolve(left) === path.resolve(right);
}

function isChildPath(candidate: string, parent: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function pruneCompactBenchmarkArtifacts(
  options: CompactRetentionCleanupOptions,
): CompactRetentionCleanupSummary {
  const retention = options.retention ?? getBenchmarkRetention();
  if (retention !== 'compact') {
    return {
      retention,
      removedPaths: [],
    };
  }

  const outputDir = path.resolve(options.outputDir);
  const removableDirs = [options.inputDir, ...(options.additionalDirs ?? [])]
    .map(dir => path.resolve(dir))
    .filter((dir, index, values) => values.indexOf(dir) === index);

  const removedPaths: string[] = [];

  for (const targetDir of removableDirs) {
    if (!fs.existsSync(targetDir)) {
      continue;
    }

    if (isSamePath(targetDir, outputDir) || isChildPath(outputDir, targetDir)) {
      throw new Error(`Refusing to prune compact artifacts because target overlaps aggregate output: ${targetDir}`);
    }

    fs.rmSync(targetDir, { recursive: true, force: true });
    removedPaths.push(targetDir);
  }

  return {
    retention,
    removedPaths,
  };
}
