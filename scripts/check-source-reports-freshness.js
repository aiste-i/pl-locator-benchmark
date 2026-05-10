const { execSync } = require('child_process');

const trackedSourceReports = [
  'reports/realworld-locator-support-matrix.json',
  'reports/realworld-locator-unsupported.json',
  'reports/realworld-semantic-css-exceptions.json',
  'reports/realworld-benchmark-corpus.json',
  'reports/realworld-semantic-target-audit.json',
  'reports/realworld-semantic-target-audit.md',
  'reports/realworld-semantic-supplement-corpus.json',
  'reports/realworld-operator-taxonomy.json',
];

execSync('npm run reports:generate:source', { stdio: 'inherit' });

execSync(`git diff --exit-code -- ${trackedSourceReports.join(' ')}`, { stdio: 'inherit' });
