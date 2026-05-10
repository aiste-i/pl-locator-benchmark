import { MutantGenerator } from './MutantGenerator';
import * as path from 'path';
import * as fs from 'fs';
import { getAppPreflightPoolPath, getAppScenariosPath, getSelectedAppId } from '../../apps';

async function main() {
    const appName = (process.argv[2] || process.env.APP_ID || process.env.npm_config_appid || getSelectedAppId()) as any;
    const budget = parseInt(process.argv[3] || process.env.BENCHMARK_BUDGET || process.env.npm_config_budget || '20', 10);
    const seed = parseInt(process.argv[4] || process.env.BENCHMARK_SEED || process.env.npm_config_seed || '12345', 10);

    console.log(`Generating scenarios for app: ${appName} (budget: ${budget}, seed: ${seed})`);

    const generator = new MutantGenerator(null as any, appName);
    
    // 1. Construct all possible scenarios from registry
    const allScenarios = await generator.constructScenariosFromRegistry();
    console.log(`Constructed ${allScenarios.length} total scenarios.`);

    // 2. Sample
    const sampled = generator.sampleScenarios(allScenarios, budget, seed);
    const preflightPool = generator.buildPreflightPool(allScenarios, budget, seed);
    console.log(`Sampled ${sampled.length} scenarios.`);
    console.log(`Prepared ${preflightPool.length} deterministic preflight candidates.`);
    const summary = generator.getSamplingSummary();
    if (summary) {
        console.log(`Category quotas: ${JSON.stringify(summary.categoryQuotas)}`);
        console.log(`Selected counts: ${JSON.stringify(summary.selectedCounts)}`);
    }

    // 3. Save
    const outputPath = getAppScenariosPath(appName);
    const preflightPoolPath = getAppPreflightPoolPath(appName);
    generator.saveScenarios(outputPath, sampled);
    generator.saveScenarios(preflightPoolPath, preflightPool);
    console.log(`Saved scenarios to ${outputPath}`);
    console.log(`Saved preflight candidate pool to ${preflightPoolPath}`);
}

main().catch(console.error);
