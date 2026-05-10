# Playwright RealWorld Mutation Benchmark

This repository implements a controlled Playwright benchmark for comparing locator-family robustness under non-breaking UI and accessibility changes.

The active benchmark compares exactly three locator families:

- `semantic-first`
- `css`
- `xpath`

Oracle locators are a separate ground-truth layer. They are not part of the comparison and are restricted to `getByTestId()` chains so postconditions remain independent from the locator family being tested.

## Active Scope

The active corpus is `realworld-active`, executed through `tests/realworld/benchmark-active.spec.ts`.

It runs 12 shared RealWorld scenarios across:

- `angular-realworld-example-app`
- `realworld`
- `vue3-realworld-example-app`

The main browser target is Chromium. Firefox and WebKit can be run separately for cross-browser checks.

## Quick Commands

Install dependencies:

```bash
npm ci
npm run install:apps
npx playwright install --with-deps chromium
```

Validate the benchmark implementation:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run validate:realworld
```

Run the primary Chromium baseline:

```bash
npm run benchmark:baseline:primary
```

Prepare and run a one-mutation sample for the default app:

```bash
npm run benchmark:prepare:app --appid=angular-realworld-example-app --budget=1 --seed=12345
npm run benchmark:mutate:app --appid=angular-realworld-example-app --limit=1
```

Aggregate and validate results:

```bash
npm run validate:results
npm run benchmark:aggregate:all
npm run benchmark:check:yield
```

## Documentation

Maintained benchmark documentation lives in [`docs/`](docs/README.md).

Start with:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the benchmark design
- [`docs/CORPUS_AND_SCENARIOS.md`](docs/CORPUS_AND_SCENARIOS.md) for the active corpus
- [`docs/LOCATORS_AND_ORACLES.md`](docs/LOCATORS_AND_ORACLES.md) for locator-family and oracle rules
- [`docs/MUTATION_PIPELINE.md`](docs/MUTATION_PIPELINE.md) for mutation generation and selection
- [`docs/DATASET_AND_RESULTS.md`](docs/DATASET_AND_RESULTS.md) for output contracts
- [`docs/REPLICATION.md`](docs/REPLICATION.md) for end-to-end reproduction

Generated source reports are kept under `reports/`. Run artifacts are written under `test-results/<app-id>/realworld-active/` and, when full retention is enabled, mirrored under `artifacts/<run-id>/`.
