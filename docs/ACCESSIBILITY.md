# Accessibility

Accessibility appears in the benchmark in two separate ways:

- accessibility-semantic mutation operators, which are part of the mutation dataset
- axe scans, which are recorded at the end of runs

Accessibility scan output does not decide locator-family success or failure. The benchmark outcome is based on the instrumented action/assertion path and oracle postconditions.

## Accessibility-Semantic Mutations

Accessibility-semantic operators stress locator surfaces such as:

- accessible names
- ARIA labels and state
- form labels and placeholders
- image alt text
- semantic HTML roles
- heading, table, landmark, and anchor semantics

These mutations are especially relevant to `semantic-first`, but they are run for all three locator families. A CSS or XPath locator can still fail after an accessibility-semantic mutation if the operator also changes DOM shape or the selected control surface in a way that affects that selector.

Implementation lives under:

- `src/webmutator/operators/dom/accessibility/`
- `src/webmutator/operators/catalog.ts`

## Axe Scan Flow

The harness runs accessibility scans near the end of each benchmark run:

1. scenario execution reaches a final state
2. page stabilization runs
3. axe analysis runs when the run has not already been invalidated
4. summary fields are stored in the run result
5. detailed artifacts are written when retention is `full`

Implementation:

- `tests/baseFixture.ts`

## Scan Status

`accessibility.scanStatus` is independent from `runStatus`.

Valid scan statuses:

- `completed`: axe ran and produced violation data.
- `failed`: axe was attempted but could not complete.
- `skipped`: scan did not run, usually because setup or mutation application invalidated the run.

This means a benchmark run can be `failed` with a completed accessibility scan. That is useful context about the failed page state, not a contradiction.

## Stabilization

Before scanning, the harness attempts a bounded stabilization strategy:

- wait for `networkidle`
- wait for animation frames
- allow a short microtask buffer

The result is recorded under:

- `accessibility.stabilization.attempted`
- `accessibility.stabilization.status`
- `accessibility.stabilization.durationMs`
- `accessibility.stabilization.strategy`

## Artifacts

Run-level result fields include:

- `accessibility.scanAttempted`
- `accessibility.scanStatus`
- `accessibility.scanError`
- `accessibility.totalViolations`
- `accessibility.violationIds`
- `accessibility.impactedNodeCount`
- `accessibility.artifactPath`
- severity counts such as `criticalCount` and `seriousCount`

Detailed axe artifacts are kept under:

- `test-results/<app-id>/realworld-active/accessibility-artifacts/`

when retention is `full`.

## Aggregate Views

Aggregation emits separate accessibility views:

- `accessibility_scan_status_summary.csv`
- `accessibility_summary_completed_only.csv`
- `accessibility_summary_all_valid_runs.csv`

Use completed-only summaries for violation statistics. Use all-valid-run summaries for scan coverage and completeness.

Do not treat failed or skipped scans as zero-violation completed scans.
