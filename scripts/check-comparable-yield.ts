import * as fs from 'fs';
import * as path from 'path';
import { evaluateComparableYield, type ComparableYieldRow } from '../src/benchmark/comparable-yield';
import { getAppResultsDir, REALWORLD_APP_IDS } from '../src/apps';

interface AggregateReport {
  applications: Array<{ applicationId: string }>;
  summaryByBrowserFamily: Array<{
    browserName: string;
    family: string;
    mutatedRuns: number;
    comparableMutatedRuns: number;
  }>;
}

function defaultAggregateReports(): string[] {
  return REALWORLD_APP_IDS.map(appId => path.join(getAppResultsDir(appId), 'aggregate', 'aggregate_report.json'))
    .filter(reportPath => fs.existsSync(reportPath));
}

function main(): void {
  const args = process.argv.slice(2).filter(arg => arg !== '--');
  const minimumYield = Number(process.env.MIN_COMPARABLE_YIELD || '0.7');
  const reportPaths = args.length > 0 ? args.map(arg => path.resolve(arg)) : defaultAggregateReports();

  if (reportPaths.length === 0) {
    console.error('No aggregate reports found for comparable-yield validation.');
    process.exit(1);
  }

  const rows: ComparableYieldRow[] = reportPaths.flatMap(reportPath => {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as AggregateReport;
    const appId = report.applications[0]?.applicationId ?? path.basename(path.dirname(path.dirname(reportPath)));
    return report.summaryByBrowserFamily.map(row => ({
      appId,
      browserName: row.browserName,
      family: row.family,
      mutatedRuns: row.mutatedRuns,
      comparableMutatedRuns: row.comparableMutatedRuns,
    }));
  });

  const failures = evaluateComparableYield(rows, minimumYield);
  if (failures.length > 0) {
    console.error(`Comparable yield check failed. Minimum required yield: ${minimumYield.toFixed(2)}`);
    for (const failure of failures) {
      console.error(
        `- ${failure.row.appId} ${failure.row.browserName} ${failure.row.family}: ` +
        `${failure.row.comparableMutatedRuns}/${failure.row.mutatedRuns} comparable mutated runs ` +
        `(${failure.yieldRatio.toFixed(2)})`,
      );
    }
    process.exit(1);
  }

  console.log(`Comparable yield check passed for ${rows.length} browser/family rows at threshold ${minimumYield.toFixed(2)}.`);
}

main();
