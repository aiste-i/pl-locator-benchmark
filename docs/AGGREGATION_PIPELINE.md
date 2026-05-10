# Aggregation Pipeline

Aggregation converts validated run-level JSON into CSV/JSON summaries for locator-family comparison.

The same aggregator is used for both:

- the primary `realworld-active` corpus
- the supplementary `realworld-semantic-supplement` corpus

Those corpora stay separated by result directory and corpus id. Supplementary outputs are not pooled into the primary denominators.

Authoritative implementation:

- `src/benchmark/runner/aggregate.ts`

Validation coverage:

- `tests/unit/aggregation-validation.spec.ts`
- `tests/unit/schema-validation.spec.ts`

## Pipeline Position

The full benchmark flow is:

1. Baseline execution
2. Reachable-target collection
3. Mutation candidate generation
4. Preflight validation
5. Final mutation selection
6. Mutated execution
7. Aggregation
8. Report generation and comparable-yield checks

Aggregation should run only after benchmark result JSON exists under an app/corpus result directory.

## Inputs

Primary input:

- `test-results/<app-id>/<corpus-id>/benchmark-runs/*.json`

Optional neighboring inputs:

- `test-results/<app-id>/<corpus-id>/scenarios.json`
- `test-results/<app-id>/<corpus-id>/scenario-preflight-results.json`

The optional files let aggregation emit selection-quality and preflight-quality summaries. The run-level summaries still work without them.

Typical corpus ids:

- `realworld-active`
- `realworld-semantic-supplement`

## Accepted Run Shape

Each consumed run must contain the corpus fields needed for fair comparison:

- `runId`
- `applicationId`
- `browserName`
- `corpusId`
- `activeScenarioId`
- `activeScenarioCategory`
- `sourceSpec`
- `locatorFamily`
- `phase`

Supplementary runs may also include:

- `corpusRole`
- `intendedSemanticEntryPoint`
- `actualSemanticEntryPoint`
- `targetLogicalKeys`
- `semanticScenarioSupportedApps`
- `semanticScenarioExclusionReason`

Aggregation validates records against `schemas/benchmark-results.schema.json` before using them. Malformed records and legacy non-corpus records are rejected.

## Normalization

Before summaries are written, aggregation normalizes the run population:

- baseline and mutated phases are kept separate
- invalid runs remain visible but are excluded from analytical failure-rate denominators
- missing accessibility blocks are treated as skipped scans, not as zero-violation completed scans
- mutation category aliases are reconciled with the operator catalog where possible
- unsupported locator-family cases stay visible in exclusion outputs
- browser identity is read from structured result data, not inferred from filenames

## Output Groups

### Run Export

- `benchmark_runs.csv`
- `aggregate_report.json`
- `run-metadata.json`

These preserve the run-level rows and high-level metadata used by later analysis.

### Family And Failure Summaries

- `summary_by_family.csv`
- `summary_by_family_and_category.csv`
- `summary_by_family_and_operator.csv`
- `failure_distribution.csv`

Use these files for locator-family comparison once denominator rules are understood.

### Browser Summaries

- `summary_by_app.csv`
- `summary_by_browser.csv`
- `summary_by_browser_and_family.csv`
- `summary_by_browser_family_and_category.csv`

These files keep Chromium, Firefox, and WebKit results separated. Chromium is the main browser unless a broader dataset is explicitly declared.

### Denominator And Exclusion Accounting

- `comparison_denominators.csv`
- `exclusion_summary.csv`
- `excluded_unsupported.csv`
- `excluded_unsupported.json`

These files explain which mutated runs are comparison-eligible and which remain auditable but excluded from fair family-level denominators.

### Accessibility Summaries

- `accessibility_scan_status_summary.csv`
- `accessibility_summary_completed_only.csv`
- `accessibility_summary_all_valid_runs.csv`

Completed-only summaries show violations from completed scans. All-valid-run summaries show scan coverage across valid runs.

### Mutation And Selection Quality

- `mutation_run_telemetry.csv`
- `operator_telemetry_summary.csv`
- `selection_summary_by_category_and_relevance.csv`
- `selection_touchpoint_summary.csv`
- `preflight_validated_summary_by_category_and_relevance.csv`

The selection-quality files are emitted when `scenarios.json` or `scenario-preflight-results.json` are present.

### Supplementary Semantic Outputs

These files are emitted for `realworld-semantic-supplement` semantic aggregate directories:

- `semantic_query_distribution.csv`
- `semantic_scenario_query_mapping.csv`
- `summary_by_semantic_query.csv`
- `summary_by_semantic_query_and_category.csv`
- `failure_distribution_by_semantic_query.csv`
- `semantic_validation_warnings.csv`

Canonical supplement aggregates additionally emit:

- `semantic_supplement_summary.csv`
- `semantic_supplement_by_category.csv`
- `semantic_supplement_by_operator.csv`
- `semantic_supplement_validation_warnings.csv`
- `semantic_supplement_summary.json`

These reports are scoped to `realworld-semantic-supplement` and the `semantic-first` family only. Baseline support and mutated runs are reported separately so CSS/XPath rows and primary-corpus rows cannot enter semantic query counts. The same data is also embedded under `semanticSupplement` in `aggregate_report.json`.

Generate the combined supplement aggregate with:

```bash
npm run benchmark:semantic:aggregate:combined
```

It writes to `test-results/realworld-semantic-supplement/thesis-facing-aggregate/`. Use this folder as the canonical combined supplement aggregate.

The combined supplement aggregate is strict: every app that supports at least one supplement scenario must have supplement benchmark runs and `scenarios.json` coverage metadata. Mixed-corpus or non-supplement scenario rows fail the command before output is written.

Generic mixed-family aggregate files such as `benchmark_runs.csv`, family summaries, CSS/XPath discordance reports, operator-diversity summaries, and comparison-denominator CSVs are suppressed from the canonical supplement folder. App-level supplement aggregates are debug/noncanonical outputs under `test-results/<app>/realworld-semantic-supplement/debug/app-aggregate/`. If stale legacy supplement aggregate folders exist, generation moves them to explicit `debug/deprecated-*` locations.

## Denominator Rules

The aggregator separates:

- all raw records
- baseline records
- mutated records
- comparison-eligible mutated records
- invalid records
- unsupported or explicitly excluded records

Use `comparisonEligible` for locator-family failure-rate denominators.

Do not treat all mutated records as the denominator. Some mutated records are retained for auditability but excluded because they were invalid, unsupported, oracle-protected, or otherwise not comparable.

For `realworld-semantic-supplement`, use only supplementary aggregate outputs when interpreting semantic-query coverage. Do not merge those counts into `realworld-active`.

Key fields:

- `comparisonEligible`
- `comparisonExclusionReason`
- `runStatus`
- `invalidRunReason`

## Outcome Semantics

`passed` means the locator family completed the benchmarked task.

`failed` means the locator family genuinely failed during the instrumented path. The failure class explains whether the failure was resolution, strictness, actionability, or assertion related.

`invalid` means the record should remain inspectable but should not count in locator-family rates. Typical causes include setup failure, mutation-application failure, oracle-integrity failure, or unsupported comparison shape.

## Mutation Telemetry Semantics

Mutation telemetry explains what was selected and how the operator behaved:

- selected candidate id
- selected target selector
- selected target tag type
- runtime category
- category
- candidate and applicability counts
- oracle skip counts
- apply duration
- final mutation outcome class

This is useful for checking whether results are dominated by a narrow set of operators or targets.

## Commands

Aggregate one app:

```bash
npm run benchmark:aggregate:app -- test-results/angular-realworld-example-app/realworld-active/benchmark-runs test-results/angular-realworld-example-app/realworld-active/aggregate
```

Aggregate one supplementary app:

```bash
npm run benchmark:semantic:aggregate:app
```

By default this writes debug/noncanonical app-level output to `test-results/<app>/realworld-semantic-supplement/debug/app-aggregate/`. The combined supplement aggregate is written to `test-results/realworld-semantic-supplement/thesis-facing-aggregate/`.

Aggregate all RealWorld apps:

```bash
npm run benchmark:aggregate:all
```

Validate results before or after aggregation:

```bash
npm run validate:results
```

Check comparable yield after aggregation:

```bash
npm run benchmark:check:yield
```

Regenerate run-derived reports from aggregate outputs:

```bash
npm run reports:generate:run
```

## Interpretation Checklist

- Use Chromium-only outputs for primary results unless cross-browser runs are explicitly included.
- Use comparison-eligible mutated denominators for locator-family failure rates.
- Keep invalid records visible but out of family-failure numerators and denominators.
- Interpret accessibility completed-only and all-valid-run summaries together.
- Inspect `operator_telemetry_summary.csv` when mutation coverage looks uneven.
- Run `npm run benchmark:check:yield` before using aggregate results in analysis.
