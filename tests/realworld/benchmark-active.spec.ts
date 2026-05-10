import fs from 'fs';
import { test, expect } from '../baseFixture';
import { STRATEGIES, StrategyName } from '../../src/locators';
import { MutantGenerator } from '../../src/benchmark/runner/MutantGenerator';
import {
  getAppPreflightPoolPath,
  getAppPreflightResultsPath,
  getAppReachableTargetsPath,
  getAppScenariosPath,
  getSelectedAppId,
} from '../../src/apps';
import { getActiveScenarioDefinitions } from './benchmark-active.scenarios';
import { WebMutator } from '../../src/webmutator/WebMutator';
import {
  resolveScenarioTouchpoints,
  type FamilyStressHints,
  type RelevanceBand,
  type ScenarioTouchpointInput,
} from '../../src/benchmark/realworld-touchpoints';
import { evaluateMutationMeaningfulness, type MutationSurfaceSnapshot } from '../../src/benchmark/mutation-quality';
import { captureMutationSurface } from '../../src/benchmark/mutation-surface';
import { getCandidateCategory } from '../../src/benchmark/runner/sampling';
import { getActiveBenchmarkTestTimeoutMs } from './helpers/benchmark-active';

const APP_ID = getSelectedAppId();
const MODE = process.env.BENCHMARK_ACTIVE_MODE || 'baseline';
const SCENARIO_FILE = getAppScenariosPath(APP_ID);
const PREFLIGHT_POOL_FILE = getAppPreflightPoolPath(APP_ID);
const PREFLIGHT_RESULTS_FILE = getAppPreflightResultsPath(APP_ID);
const REACHABLE_TARGETS_FILE = getAppReachableTargetsPath(APP_ID);
const MUTATION_LIMIT = Number(process.env.MUTATION_LIMIT || process.env.npm_config_limit || Number.MAX_SAFE_INTEGER);
const BENCHMARK_BUDGET = Number(process.env.BENCHMARK_BUDGET || process.env.npm_config_budget || 20);
const BENCHMARK_SEED = Number(process.env.BENCHMARK_SEED || process.env.npm_config_seed || 12345);
const PREFLIGHT_TEST_TIMEOUT_MS = Number(process.env.PREFLIGHT_TEST_TIMEOUT_MS || 60000);
const ACTIVE_SCENARIOS = getActiveScenarioDefinitions();

interface PreflightResultRow {
  candidateId: string;
  scenarioId: string;
  viewContext: string;
  operator: string;
  operatorCategory: string;
  selector: string;
  success: boolean;
  reason: string | null;
  durationMs: number;
  touchpointLogicalKeys: string[];
  relevanceBand: RelevanceBand;
  relevanceScore: number;
  familyStressHints: FamilyStressHints;
  categoryAvailabilityHint: boolean;
  meaningfulEffect: boolean;
  meaningfulEffectReason: string | null;
}

const preflightResults: PreflightResultRow[] = [];

function describeScenario(
  strategy: StrategyName,
  scenario: ReturnType<typeof getActiveScenarioDefinitions>[number],
  testTitle = `${scenario.displayName} [${strategy}]`,
) {
  test(testTitle, async ({ page, request, locators, oracle, appAdapter, applyDeferredMutation, setScenarioMetadata }) => {
    test.setTimeout(getActiveBenchmarkTestTimeoutMs());
    setScenarioMetadata({
      activeScenarioId: scenario.scenarioId,
      activeScenarioCategory: scenario.category,
      sourceSpec: scenario.sourceSpec,
    });
    try {
      await scenario.run({ page, request, locators, oracle, appAdapter, applyDeferredMutation });
    } catch (error) {
      if (MODE !== 'mutate') {
        throw error;
      }
    }
  });
}

if (MODE === 'baseline') {
  for (const strategy of STRATEGIES) {
    test.describe(`RealWorld Active Baseline [${strategy}] @app:${APP_ID}`, () => {
      test.use({ locatorStrategy: strategy });
      for (const scenario of ACTIVE_SCENARIOS) {
        describeScenario(strategy, scenario);
      }
    });
  }
}

if (MODE === 'collect') {
  test.describe(`RealWorld Active Collection @app:${APP_ID}`, () => {
    for (const scenario of ACTIVE_SCENARIOS) {
      test(`collect reachable targets: ${scenario.displayName}`, async ({ page, request, locators, oracle, appAdapter, setScenarioMetadata }) => {
        setScenarioMetadata({
          activeScenarioId: scenario.scenarioId,
          activeScenarioCategory: scenario.category,
          sourceSpec: scenario.sourceSpec,
        });

        const generator = new MutantGenerator(page, APP_ID);
          await scenario.collect({
          page,
          request,
          locators,
          oracle,
          appAdapter,
          applyDeferredMutation: async () => undefined,
          generator,
            async collectCheckpoint(viewContext: string, touchpoints: ScenarioTouchpointInput[] = []) {
              const resolvedTouchpoints = await resolveScenarioTouchpoints(APP_ID, scenario.scenarioId, touchpoints);
              await generator.collectReachableTargets({
                scenarioId: scenario.scenarioId,
                scenarioCategory: scenario.category,
                sourceSpec: scenario.sourceSpec,
                viewContext,
                touchpoints: resolvedTouchpoints,
              });
            },
          });

        await generator.saveRegistryToFile();
        expect(fs.existsSync(REACHABLE_TARGETS_FILE)).toBe(true);
        const data = JSON.parse(fs.readFileSync(REACHABLE_TARGETS_FILE, 'utf8'));
        expect(Array.isArray(data.targets ?? data)).toBe(true);
      });
    }
  });
}

if (MODE === 'mutate' && fs.existsSync(SCENARIO_FILE)) {
  const generator = new MutantGenerator(null as any, APP_ID);
  const scenarios = generator.loadScenarios(SCENARIO_FILE).slice(0, MUTATION_LIMIT);

  for (const mutationScenario of scenarios) {
    const matchingScenario = ACTIVE_SCENARIOS.find(scenario => scenario.scenarioId === mutationScenario.scenarioId);
    if (!matchingScenario) {
      throw new Error(`Active mutation scenario ${mutationScenario.scenarioId} does not map to an active benchmark scenario.`);
    }

    for (const strategy of STRATEGIES) {
      test.describe(`RealWorld Active Mutation: ${mutationScenario.operator.constructor.name} [${strategy}] @app:${APP_ID}`, () => {
        test.use({
          locatorStrategy: strategy,
          mutation: mutationScenario,
        });

        describeScenario(
          strategy,
          matchingScenario,
          `${matchingScenario.displayName} [${strategy}] (${mutationScenario.scenarioId} :: ${mutationScenario.candidateId ?? mutationScenario.selector})`,
        );
      });
    }
  }
}

if (MODE === 'preflight' && fs.existsSync(PREFLIGHT_POOL_FILE)) {
  const generator = new MutantGenerator(null as any, APP_ID);
  const scenarios = generator.loadScenarios(PREFLIGHT_POOL_FILE);

  test.afterAll(async () => {
    const successfulCountsByCategory = preflightResults.reduce((acc, result) => {
      if (result.success) {
        acc[result.operatorCategory] = (acc[result.operatorCategory] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    const successfulCountsByOperator = preflightResults.reduce((acc, result) => {
      if (result.success) {
        acc[result.operator] = (acc[result.operator] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    const payload = {
      metadata: {
        applicationId: APP_ID,
        generatedAt: new Date().toISOString(),
        budget: BENCHMARK_BUDGET,
        seed: BENCHMARK_SEED,
        totalCandidates: scenarios.length,
        successfulCandidates: preflightResults.filter(result => result.success).length,
        successfulCountsByCategory,
        successfulCountsByOperator,
      },
      results: preflightResults,
    };
    fs.writeFileSync(PREFLIGHT_RESULTS_FILE, JSON.stringify(payload, null, 2));
  });

  test.describe(`RealWorld Active Preflight @app:${APP_ID}`, () => {
    for (const mutationScenario of scenarios) {
      const matchingScenario = ACTIVE_SCENARIOS.find(scenario => scenario.scenarioId === mutationScenario.scenarioId);
      if (!matchingScenario) {
        throw new Error(`Active preflight scenario ${mutationScenario.scenarioId} does not map to an active benchmark scenario.`);
      }

      test(`preflight ${mutationScenario.operator.constructor.name} :: ${mutationScenario.scenarioId} :: ${mutationScenario.candidateId ?? mutationScenario.selector}`, async ({
        page,
        request,
        locators,
        oracle,
        appAdapter,
        setScenarioMetadata,
      }) => {
        test.setTimeout(PREFLIGHT_TEST_TIMEOUT_MS);
        setScenarioMetadata({
          activeScenarioId: matchingScenario.scenarioId,
          activeScenarioCategory: matchingScenario.category,
          sourceSpec: matchingScenario.sourceSpec,
        });

        let checkpointReached = false;
        let durationMs = 0;
        let reason: string | null = null;
        let success = false;
        let meaningfulEffect = false;
        let meaningfulEffectReason: string | null = null;

        try {
          await matchingScenario.collect({
            page,
            request,
            locators,
            oracle,
            appAdapter,
            applyDeferredMutation: async () => undefined,
            generator: new MutantGenerator(page, APP_ID),
            async collectCheckpoint(viewContext: string) {
              if (viewContext !== mutationScenario.viewContext || checkpointReached) {
                return;
              }

              checkpointReached = true;
              const mutator = new WebMutator();
              const beforeSurface = await captureMutationSurface(page, mutationScenario.selector);
              const startedAt = Date.now();
              const record = await mutator.applyMutation(page, mutationScenario.selector, mutationScenario.operator);
              durationMs = Date.now() - startedAt;
              const afterSurface = await captureMutationSurface(page, mutationScenario.selector);
              const operatorCategory = getCandidateCategory(mutationScenario);
              const meaningfulResult = evaluateMutationMeaningfulness(
                operatorCategory,
                mutationScenario.relevanceBand,
                beforeSurface,
                afterSurface,
              );
              meaningfulEffect = meaningfulResult.meaningful;
              meaningfulEffectReason = meaningfulResult.reason;
              success = record.success && meaningfulResult.meaningful;
              reason = record.error ?? meaningfulResult.reason ?? null;
            },
          });
        } catch (error: any) {
          reason = error?.message ?? 'preflight-collection-failed';
        }

        if (!checkpointReached) {
          reason = reason ?? `checkpoint-not-reached:${mutationScenario.viewContext}`;
        }

        preflightResults.push({
          candidateId: mutationScenario.candidateId ?? mutationScenario.selector,
          scenarioId: mutationScenario.scenarioId ?? matchingScenario.scenarioId,
          viewContext: mutationScenario.viewContext ?? 'unknown',
          operator: mutationScenario.operator.constructor.name,
          operatorCategory: getCandidateCategory(mutationScenario),
          selector: mutationScenario.selector,
          success: checkpointReached && success,
          reason,
          durationMs,
          touchpointLogicalKeys: mutationScenario.touchpointLogicalKeys ?? [],
          relevanceBand: mutationScenario.relevanceBand ?? 'generic',
          relevanceScore: mutationScenario.relevanceScore ?? 0,
          familyStressHints: mutationScenario.familyStressHints ?? { semantic: false, css: false, xpath: false },
          categoryAvailabilityHint: mutationScenario.categoryAvailabilityHint ?? false,
          meaningfulEffect,
          meaningfulEffectReason,
        });
      });
    }
  });
}
