# Mutation Pipeline

The mutation pipeline turns reachable page targets into deterministic, preflight-validated mutation scenarios.

Implementation:

- `src/benchmark/runner/MutantGenerator.ts`
- `src/benchmark/runner/generate-scenarios.ts`
- `src/benchmark/runner/prepare-scenarios.ts`
- `src/benchmark/runner/finalize-scenarios.ts`
- `src/benchmark/runner/sampling.ts`
- `src/webmutator/`

## End-To-End Flow

For each app:

1. Run baseline scenarios.
2. Collect reachable targets at scenario checkpoints.
3. Generate candidate mutations from reachable targets and operator applicability.
4. Preflight an oversampled candidate pool.
5. Select the final scenario set deterministically.
6. Execute mutated benchmark runs.
7. Aggregate outputs.

The default corpus id is supplied with:

```bash
BENCHMARK_CORPUS_ID=realworld-active
```

Most npm scripts already set this where needed.

## Reachable Target Collection

Scenario `collect(...)` functions navigate to a checkpoint and call `collectCheckpoint(...)`.

The collector records:

- checkpoint name
- logical key touchpoints
- target selectors
- target role in the scenario
- target visibility and actionability context where available

Output:

- `test-results/<app-id>/realworld-active/reachable-targets.json`

## Candidate Generation

Candidate generation combines:

- reachable targets
- operator catalog entries
- oracle-safety checks
- applicability checks
- touchpoint relevance
- mutation budget and seed controls

The generator avoids treating all DOM nodes as equally useful. Touchpoint-aware sampling gives preference to targets connected to the benchmarked action or assertion surface.

## Preflight

Preflight executes candidates at their intended checkpoint before they are admitted to the final selected set.

It rejects candidates that:

- cannot reach the checkpoint
- are not applicable at runtime
- violate oracle safety
- fail behavior-preservation gates
- produce no meaningful effect
- break setup rather than locator robustness

Outputs:

- `scenario-preflight-pool.json`
- `scenario-preflight-results.json`

## Finalization

Finalization selects from preflight-validated candidates only.

Controls:

- `BENCHMARK_BUDGET`
- `BENCHMARK_SEED`
- `PREFLIGHT_OVERSAMPLE_FACTORS`
- `PREFLIGHT_TEST_TIMEOUT_MS`

For budgets of four or more, selection attempts mandatory coverage across:

- `structural`
- `content`
- `accessibility-semantic`
- `visibility-interaction-state`

Output:

- `scenarios.json`

## Mutation Execution

Mutated runs apply the selected mutation at a named deferred checkpoint inside the scenario. The same scenario then continues with the selected locator family.

Mutation run outcomes can be:

- `passed`: locator family handled the mutation.
- `failed`: locator family failed in a classified way.
- `invalid`: the run cannot fairly contribute to the locator comparison.

Failed mutated runs are expected. The post-run quality gates are schema validation, aggregation, and comparable-yield checks.

## Retention

Retention is controlled with:

```bash
BENCHMARK_RETENTION=full
BENCHMARK_RETENTION=compact
```

`full` keeps raw run JSON, accessibility artifacts, and artifact mirrors.

`compact` keeps aggregate outputs and reports, then prunes raw benchmark-run and accessibility-artifact directories after aggregation.
