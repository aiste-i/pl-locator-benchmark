# Benchmark Architecture

The benchmark measures how three Playwright locator families behave when the same user task is re-run after controlled, non-breaking UI mutation. The architecture separates four concerns:

- benchmark subject applications
- shared scenario logic
- locator-family implementations
- mutation, result, and aggregation infrastructure

The benchmark compares `semantic-first`, `css`, and `xpath`. Oracle locators are excluded from that comparison and are used only to verify setup, preconditions, and postconditions.

## Core Modules

- `apps/`: local application subjects used by the benchmark.
- `src/apps/`: app registry, route adapters, startup commands, and per-app metadata.
- `src/benchmark/realworld-corpus.ts`: active corpus manifest and source-spec dispositions.
- `tests/realworld/benchmark-active.spec.ts`: executable corpus entry point.
- `tests/realworld/benchmark-active.scenarios.ts`: shared scenario definitions.
- `tests/realworld/helpers/`: scenario support, setup data, API helpers, and app navigation helpers.
- `src/locators/apps/`: per-app locator implementations for benchmarked families and oracles.
- `src/locators/realworld/`: shared logical keys, coverage reporting, and CSS/XPath audits.
- `src/webmutator/`: mutation execution, mutation records, operator registry, and safety utilities.
- `src/benchmark/runner/`: collection, generation, preflight, finalization, and aggregation.
- `schemas/benchmark-results.schema.json`: formal JSON result schema.
- `reports/`: generated source reports.

## Execution Model

The benchmark runs in phases:

1. Baseline execution verifies each scenario/family/browser tuple against the unmutated app.
2. Collection discovers reachable targets at scenario checkpoints.
3. Generation creates candidate mutation scenarios from the reachable target pool.
4. Preflight validates candidates at the checkpoint where they will be applied.
5. Finalization selects a deterministic mutation set from validated candidates.
6. Mutated execution applies selected mutations and re-runs the same scenario logic.
7. Aggregation turns run-level JSON into analysis-ready CSV and JSON summaries.

Scenario logic is shared across locator families. The benchmark fixture injects the selected app, locator family, browser, corpus, and mutation mode through environment variables and Playwright configuration.

## Comparison Boundary

The benchmark compares locator robustness at family level:

- `semantic-first`: starts from a semantic Playwright query such as `getByRole`, `getByLabel`, `getByText`, `getByPlaceholder`, `getByAltText`, or `getByTitle`.
- `css`: uses CSS selectors only.
- `xpath`: uses XPath selectors only.

Rules enforced by source and validation:

- benchmarked scenario actions are identical across families
- only locator resolution changes by family
- no benchmarked locator uses cross-family fallback
- unsupported cases stay visible in reports
- oracle locators do not participate in family comparison

## Harness Responsibilities

`tests/baseFixture.ts` is the main harness. It:

- resolves the active app adapter and locator implementation
- creates benchmark and oracle locator wrappers
- applies deferred mutations at named scenario checkpoints
- records structured action/assertion data
- classifies failures
- runs accessibility scans when appropriate
- writes result JSON and CSV mirrors
- links run metadata to artifacts

The wrapper layer is important because failure classification depends on knowing whether a failure happened during locator resolution, actionability, or assertion.

## App Boundaries

The RealWorld apps are benchmark subjects, not benchmark implementation code. App-side edits should stay limited to:

- parity fixes needed for comparable user flows
- stable `data-testid` hooks needed for pure oracle grounding
- benchmark-neutral UI affordances that preserve the user task

Do not make an app easier for one locator family by changing the task semantics or adding family-specific fallback behavior.

## Generated Reports

The repo produces two classes of generated reports:

- source-derived reports: corpus manifests, operator taxonomy, locator coverage, and semantic supplement source audits
- run-derived reports: aggregate summaries, accessibility summaries, mutation telemetry

Source-derived reports are suitable for PR freshness checks. Run-derived reports depend on the dataset currently present under `test-results/`.
