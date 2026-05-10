# Replication Guide

This guide reproduces the active RealWorld benchmark from a clean checkout.

## Requirements

- Node.js 20.x for CI-equivalent runs
- npm compatible with the lockfile
- Playwright browsers installed locally
- serial execution; benchmark configuration assumes `workers: 1`

Install Chromium:

```bash
npx playwright install --with-deps chromium
```

Install all supported browsers:

```bash
npx playwright install --with-deps chromium firefox webkit
```

## Clean Install

```bash
git clone <repo-url>
cd benchmark
npm ci
npm run install:apps
npx playwright install --with-deps chromium
```

## Validate Before Running

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run validate:realworld
```

## Minimal One-App Run

```bash
npm run benchmark:baseline:app --appid=angular-realworld-example-app
npm run benchmark:prepare:app --appid=angular-realworld-example-app --budget=1 --seed=12345
npm run benchmark:mutate:app --appid=angular-realworld-example-app --limit=1
npm run validate:results -- test-results/angular-realworld-example-app/realworld-active/benchmark-runs
npm run benchmark:aggregate:app -- test-results/angular-realworld-example-app/realworld-active/benchmark-runs test-results/angular-realworld-example-app/realworld-active/aggregate
```

Expected outputs:

- `reachable-targets.json`
- `scenario-preflight-pool.json`
- `scenario-preflight-results.json`
- `scenarios.json`
- `benchmark-runs/*.json`
- `aggregate/*.csv`
- `aggregate/aggregate_report.json`
- `aggregate/run-metadata.json`

## Primary Chromium Dataset

```bash
npm run benchmark:baseline:primary
npm run benchmark:prepare:app --appid=angular-realworld-example-app --budget=20 --seed=12345
npm run benchmark:prepare:app --appid=realworld --budget=20 --seed=12345
npm run benchmark:prepare:app --appid=vue3-realworld-example-app --budget=20 --seed=12345
npm run benchmark:mutate:all
npm run validate:results
npm run benchmark:aggregate:all
npm run benchmark:check:yield
npm run reports:generate:run
```

This is the primary path for repo-level Chromium results.

## Cross-Browser Baseline

```bash
npx playwright install --with-deps chromium firefox webkit
npm run benchmark:baseline:cross-browser
npm run validate:results
npm run benchmark:aggregate:all
```

Cross-browser runs are supplementary unless the benchmark scope is expanded beyond Chromium.

## Useful Environment Variables

- `APP_ID`: selected app id.
- `PLAYWRIGHT_BROWSERS`: comma-separated browser list.
- `BENCHMARK_CORPUS_ID`: usually `realworld-active`.
- `BENCHMARK_ACTIVE_MODE`: `baseline`, `collect`, `preflight`, or `mutate`.
- `BENCHMARK_BUDGET`: mutation budget when not passed through npm config.
- `BENCHMARK_SEED`: deterministic seed.
- `MUTATION_LIMIT`: run only a sample of finalized mutations.
- `BENCHMARK_RETENTION`: `full` or `compact`.

## Troubleshooting

Missing browsers:

```bash
npx playwright install --with-deps chromium
```

App startup problems:

- run `npm run install:apps`
- ensure required local ports are free
- keep execution serial

Result validation errors:

- run `npm run validate:results -- <path>`
- fix schema issues before aggregation

Preparation failures:

- inspect `scenario-preflight-results.json`
- inspect `scenario-preflight-pool.json`
- inspect `scenarios.json`
- lower the budget or improve candidate coverage if the validated pool is insufficient

Compact retention surprises:

- `BENCHMARK_RETENTION=compact` prunes raw benchmark-run and accessibility-artifact directories after successful aggregation
- use `BENCHMARK_RETENTION=full` when inspecting raw artifacts
