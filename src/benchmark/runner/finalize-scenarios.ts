import * as fs from 'fs';
import { MutantGenerator } from './MutantGenerator';
import { CATEGORY_ORDER, getCandidateCategory } from './sampling';
import {
  getAppPreflightPoolPath,
  getAppPreflightResultsPath,
  getAppScenariosPath,
  getSelectedAppId,
} from '../../apps';
import {
  REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
  getBenchmarkCorpusId,
  requiresMandatoryCategoryCoverage,
} from '../realworld-corpus';

interface PreflightResultRow {
  candidateId: string;
  scenarioId: string;
  viewContext: string;
  operator: string;
  operatorCategory?: string;
  selector: string;
  success: boolean;
  reason: string | null;
  durationMs: number;
  touchpointLogicalKeys?: string[];
  relevanceBand?: string;
  relevanceScore?: number;
  familyStressHints?: {
    semantic: boolean;
    css: boolean;
    xpath: boolean;
  };
  categoryAvailabilityHint?: boolean;
  meaningfulEffect?: boolean;
  meaningfulEffectReason?: string | null;
}

interface PreflightResultPayload {
  metadata: {
    applicationId: string;
    generatedAt: string;
    budget: number;
    seed: number;
    totalCandidates: number;
    successfulCandidates: number;
    successfulCountsByCategory?: Record<string, number>;
    successfulCountsByOperator?: Record<string, number>;
  };
  results: PreflightResultRow[];
}

function countByCategory(candidates: ReturnType<MutantGenerator['loadScenarios']>): Record<string, number> {
  return Object.fromEntries(
    CATEGORY_ORDER.map(category => [
      category,
      candidates.filter(candidate => getCandidateCategory(candidate) === category).length,
    ]),
  ) as Record<string, number>;
}

function countByOperator(candidates: ReturnType<MutantGenerator['loadScenarios']>): Record<string, number> {
  return candidates.reduce((acc, candidate) => {
    const operatorName = candidate.operator.constructor.name;
    acc[operatorName] = (acc[operatorName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

async function main() {
  const appName = (process.argv[2] || process.env.APP_ID || process.env.npm_config_appid || getSelectedAppId()) as any;
  const budget = parseInt(process.argv[3] || process.env.BENCHMARK_BUDGET || process.env.npm_config_budget || '20', 10);
  const seed = parseInt(process.argv[4] || process.env.BENCHMARK_SEED || process.env.npm_config_seed || '12345', 10);
  const corpusId = getBenchmarkCorpusId();
  const isSemanticSupplement = corpusId === REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID;

  const generator = new MutantGenerator(null as any, appName);
  const poolPath = getAppPreflightPoolPath(appName);
  const resultPath = getAppPreflightResultsPath(appName);
  const outputPath = getAppScenariosPath(appName);

  if (!fs.existsSync(poolPath)) {
    throw new Error(`Preflight pool does not exist: ${poolPath}`);
  }

  if (!fs.existsSync(resultPath)) {
    throw new Error(`Preflight results do not exist: ${resultPath}`);
  }

  const pool = generator.loadScenarios(poolPath);
  const payload = JSON.parse(fs.readFileSync(resultPath, 'utf8')) as PreflightResultPayload;
  const successfulCandidateIds = new Set(
    payload.results.filter(result => result.success).map(result => result.candidateId),
  );
  const validatedCandidates = pool.filter(candidate => candidate.candidateId && successfulCandidateIds.has(candidate.candidateId));
  const selected = generator.sampleScenarios(validatedCandidates, budget, seed);
  const validatedCountsByCategory = countByCategory(validatedCandidates);
  const validatedCountsByOperator = countByOperator(validatedCandidates);
  const enforceMandatoryCoverage = requiresMandatoryCategoryCoverage();
  const missingMandatoryCategories =
    enforceMandatoryCoverage && budget >= CATEGORY_ORDER.length
      ? CATEGORY_ORDER.filter(category => (validatedCountsByCategory[category] || 0) === 0)
      : [];

  if ((!isSemanticSupplement && selected.length < budget) || missingMandatoryCategories.length > 0) {
    const availableByOperator = payload.metadata.successfulCountsByOperator ?? payload.results.reduce((acc, result) => {
      if (result.success) {
        acc[result.operator] = (acc[result.operator] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    const rankedRejectedCandidates = pool
      .filter(candidate => candidate.candidateId && !successfulCandidateIds.has(candidate.candidateId))
      .sort((left, right) => (right.relevanceScore ?? 0) - (left.relevanceScore ?? 0))
      .slice(0, 8)
      .map(candidate => {
        const rejection = payload.results.find(result => result.candidateId === candidate.candidateId);
        return {
          candidateId: candidate.candidateId,
          operator: candidate.operator.constructor.name,
          operatorCategory: getCandidateCategory(candidate),
          scenarioId: candidate.scenarioId,
          relevanceBand: candidate.relevanceBand ?? 'generic',
          relevanceScore: candidate.relevanceScore ?? 0,
          reason: rejection?.reason ?? 'unknown',
          meaningfulEffectReason: rejection?.meaningfulEffectReason ?? null,
        };
      });
    throw new Error(
      `Only ${selected.length} validated mutation candidates are available for ${appName}; requested budget ${budget}. ` +
      (missingMandatoryCategories.length > 0
        ? `Missing mandatory categories: ${missingMandatoryCategories.join(', ')}. `
        : '') +
      `Validated counts by category: ${JSON.stringify(validatedCountsByCategory)}. ` +
      `Validated counts by operator: ${JSON.stringify(validatedCountsByOperator)}. ` +
      `Successful preflight candidates by operator: ${JSON.stringify(availableByOperator)}. ` +
      `Top rejected candidates: ${JSON.stringify(rankedRejectedCandidates)}`,
    );
  }

  if (isSemanticSupplement && selected.length < budget) {
    console.warn(
      `Semantic supplement selected ${selected.length} validated mutation candidates for ${appName}; requested budget ${budget}. ` +
      'Continuing because supplementary coverage may have fewer valid candidates than the requested diagnostic budget.',
    );
  }

  const samplingSummary = generator.getSamplingSummary();
  if (samplingSummary) {
    samplingSummary.validatedCountsByCategory = validatedCountsByCategory;
    samplingSummary.validatedCountsByOperator = validatedCountsByOperator;
    samplingSummary.mandatoryCoverageSatisfied =
      samplingSummary.mandatoryCoverageSatisfied && missingMandatoryCategories.length === 0;
  }
  generator.saveScenarios(outputPath, selected);
  console.log(`Saved ${selected.length} validated scenarios to ${outputPath}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
