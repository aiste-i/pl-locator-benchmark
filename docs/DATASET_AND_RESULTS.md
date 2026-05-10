# Dataset And Results

The benchmark dataset records run-level data for locator-family comparison under controlled mutation.

Authoritative contract:

- `src/benchmark/result-contract.ts`
- `schemas/benchmark-results.schema.json`

Current versions are defined in source:

- `schemaVersion`: `1.0.0`
- `datasetVersion`: `2026.04`

## Artifact Layout

App and corpus scoped outputs:

- `test-results/<app-id>/realworld-active/reachable-targets.json`
- `test-results/<app-id>/realworld-active/scenario-preflight-pool.json`
- `test-results/<app-id>/realworld-active/scenario-preflight-results.json`
- `test-results/<app-id>/realworld-active/scenarios.json`
- `test-results/<app-id>/realworld-active/benchmark-runs/*.json`
- `test-results/<app-id>/realworld-active/aggregate/`
- `test-results/<app-id>/realworld-active/accessibility-artifacts/`

Full-retention mirrors:

- `artifacts/<run-id>/run-metadata.json`
- `artifacts/<run-id>/results.json`
- `artifacts/<run-id>/results.csv`

Generated reports:

- `reports/`

## Top-Level Dimensions

Each run record captures:

- schema and dataset versions
- run id
- generated timestamp
- Git commit, branch, and dirty-state metadata
- Node/npm/Playwright versions
- OS/platform/architecture
- application id
- corpus id
- active scenario id
- source spec
- locator family
- browser name and optional channel
- phase: `baseline` or `mutated`

## Mutation Fields

Mutation metadata is nested under `mutation`:

- `mutationId`
- `operatorId`
- `operatorCategory`
- `candidateId`
- `seed`
- `selected`
- `applied`
- `skipped`
- `skipReason`

Legacy aliases such as `changeId`, `changeCategory`, and `changeOperator` may still appear for aggregate compatibility. New analysis should prefer `mutation.*`.

## Outcome Fields

Important outcome fields:

- `runStatus`: `passed`, `failed`, or `invalid`
- `failureClass`: `NO_MATCH`, `MULTIPLE_MATCH`, `ACTIONABILITY`, `ASSERTION`, or `null`
- `failureStage`: where the failure occurred
- `durationMs`
- `instrumentationPathUsed`: `structured`, `mixed`, or `fallback`
- `comparisonEligible`
- `comparisonExclusionReason`
- `invalidRunReason`
- `oracleIntegrityOk`
- `oracleIntegrityError`

Use `comparisonEligible` for locator-family denominator decisions.

## Accessibility Fields

Accessibility data includes:

- scan attempt and status
- scan error
- total violations
- violation IDs
- impacted node count
- artifact path
- stabilization result
- severity counts

Accessibility scan status must be interpreted separately from benchmark run status.

## CSV Output

Run-level CSV rows flatten the main JSON fields:

- identity
- app/corpus/scenario/family/browser dimensions
- phase and outcome
- comparison eligibility
- mutation metadata
- accessibility summary
- optional artifact paths

Aggregate CSVs then summarize those rows by family, browser, mutation category, operator, failure class, and accessibility status.

## Validation

Validate result JSON with:

```bash
npm run validate:results
```

or validate a specific path:

```bash
npm run validate:results -- test-results/angular-realworld-example-app/realworld-active/benchmark-runs
```

Aggregation rejects malformed or legacy non-corpus records instead of mixing them into the active dataset.

## Interpretation Rules

- Keep baseline and mutated phases distinct.
- Use Chromium as the main browser unless a broader dataset is explicitly declared.
- Use `comparisonEligible` denominators for locator-family failure rates.
- Exclude `invalid` runs from locator-family failure analysis.
- Treat accessibility counts as context, not as pass/fail oracle results.
- Keep unsupported family/key combinations visible in reports.
