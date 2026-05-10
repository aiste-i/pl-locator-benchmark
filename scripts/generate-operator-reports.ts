import fs from 'fs';
import path from 'path';
import { getOperatorCatalog } from '../src/webmutator/operators/catalog';

function main() {
  const reportsDir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const catalog = getOperatorCatalog().map(entry => ({
    operator: entry.type,
    implementationKind: entry.implementationKind,
    benchmarkScope: entry.benchmarkScope,
    runtimeCategory: entry.runtimeCategory,
    thesisCategory: entry.thesisCategory,
    domConditions: entry.domConditions,
    safetyGuard: entry.safetyGuard,
    excludedReason: entry.excludedReason ?? null,
  }));

  fs.writeFileSync(
    path.join(reportsDir, 'realworld-operator-taxonomy.json'),
    JSON.stringify(catalog, null, 2),
  );
}

main();
