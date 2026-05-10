import { generateSupportMatrix, writeCoverageReports } from '../src/locators/realworld/coverage';

const rows = generateSupportMatrix();
writeCoverageReports(rows);

console.log(`Generated ${rows.length} support-matrix rows.`);
console.log(`Unsupported rows: ${rows.filter(row => !row.supported).length}.`);
