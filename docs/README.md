# Benchmark Documentation

This folder contains the maintained documentation for the Playwright RealWorld mutation benchmark.

## Reading Order

- [`ARCHITECTURE.md`](ARCHITECTURE.md): repository structure, execution model, and design boundaries.
- [`APPS.md`](APPS.md): benchmark subject applications and app adapter responsibilities.
- [`CORPUS_AND_SCENARIOS.md`](CORPUS_AND_SCENARIOS.md): active corpus, scenario inventory, source-spec dispositions, and exclusion rationale.
- [`LOCATORS_AND_ORACLES.md`](LOCATORS_AND_ORACLES.md): compared locator families, logical keys, benchmark wrappers, and oracle purity.
- [`MUTATION_PIPELINE.md`](MUTATION_PIPELINE.md): target collection, candidate generation, preflight, finalization, and mutation execution.
- [`MUTATION_OPERATORS.md`](MUTATION_OPERATORS.md): operator catalog and mutation categories.
- [`ACCESSIBILITY.md`](ACCESSIBILITY.md): accessibility-semantic mutations and axe scan output.
- [`DATASET_AND_RESULTS.md`](DATASET_AND_RESULTS.md): result schema, field meanings, artifact layout, and retention modes.
- [`AGGREGATION_PIPELINE.md`](AGGREGATION_PIPELINE.md): aggregate CSV/JSON outputs and denominator semantics.
- [`CI_AND_REPORTS.md`](CI_AND_REPORTS.md): workflow gates, report generation, and freshness checks.
- [`REPLICATION.md`](REPLICATION.md): clean-checkout reproduction commands.

## Source Of Truth

Documentation should describe the implementation that exists in the repo. When behavior changes, update the corresponding source and documentation together:

- Corpus: `src/benchmark/realworld-corpus.ts`
- Scenario bodies: `tests/realworld/benchmark-active.scenarios.ts`
- App registry: `src/apps/index.ts`
- Locator keys and coverage: `src/locators/realworld/`
- Mutation operators: `src/webmutator/operators/catalog.ts`
- Runner pipeline: `src/benchmark/runner/`
- Result contract: `src/benchmark/result-contract.ts`
- Aggregation: `src/benchmark/runner/aggregate.ts`

Generated files in `reports/` are source reports, not replacement documentation. Regenerate them when source behavior changes.
