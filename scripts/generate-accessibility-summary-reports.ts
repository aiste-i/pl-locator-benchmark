import fs from 'fs';
import path from 'path';
import { REALWORLD_APP_IDS } from '../src/apps';

type CsvRow = Record<string, string>;

function parseCsv(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) {
    return [];
  }

  const [headerLine, ...rowLines] = content.split(/\r?\n/);
  const headers = headerLine.split(',');

  return rowLines
    .filter(line => line.trim().length > 0)
    .map(line => {
      const values = line.split(',');
      return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    });
}

function writeCsv(filePath: string, rows: CsvRow[]) {
  if (rows.length === 0) {
    fs.writeFileSync(filePath, '');
    return;
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(row =>
      headers
        .map(header => {
          const value = row[header] ?? '';
          return value.includes(',') ? `"${value}"` : value;
        })
        .join(','),
    ),
  ];

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function readAggregateCsv(appId: string, fileName: string): CsvRow[] {
  const filePath = path.join(process.cwd(), 'test-results', appId, 'realworld-active', 'aggregate', fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing aggregate artifact for ${appId}: ${filePath}`);
  }

  return parseCsv(filePath).map(row => ({
    appId,
    corpusId: 'realworld-active',
    ...row,
  }));
}

function main() {
  const reportsDir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const completedOnly = REALWORLD_APP_IDS.flatMap(appId =>
    readAggregateCsv(appId, 'accessibility_summary_completed_only.csv'),
  );
  const allValidRuns = REALWORLD_APP_IDS.flatMap(appId =>
    readAggregateCsv(appId, 'accessibility_summary_all_valid_runs.csv'),
  );
  const scanStatus = REALWORLD_APP_IDS.flatMap(appId =>
    readAggregateCsv(appId, 'accessibility_scan_status_summary.csv'),
  );

  writeCsv(
    path.join(reportsDir, 'realworld-accessibility-summary-completed-only.csv'),
    completedOnly,
  );
  writeCsv(
    path.join(reportsDir, 'realworld-accessibility-summary-all-valid-runs.csv'),
    allValidRuns,
  );
  writeCsv(
    path.join(reportsDir, 'realworld-accessibility-scan-status-summary.csv'),
    scanStatus,
  );
}

main();
