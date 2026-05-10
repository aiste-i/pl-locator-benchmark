# Benchmark Applications

The benchmark runs the active RealWorld corpus against three applications:

- `angular-realworld-example-app`
- `realworld`
- `vue3-realworld-example-app`

## Registry And Selection

The app registry lives in `src/apps/index.ts`.

Important exports:

- `APP_REGISTRY`: all supported app adapters
- `REALWORLD_APP_IDS`: the three apps included in the active RealWorld benchmark
- `getSelectedAppId()`: reads `APP_ID` or `npm_config_appid`
- `getAppResultsDir()`: creates app/corpus-scoped result paths

NPM commands usually select an app with:

```bash
npm run benchmark:baseline:app --appid=angular-realworld-example-app
```

Inside npm this becomes `npm_config_appid`, which the benchmark reads through `getSelectedAppId()`.

## Adapter Responsibilities

Each app adapter describes how the benchmark should interact with that app as a subject:

- app id and display metadata
- local working directory
- install/start/build behavior where needed
- base URL and route helpers
- framework-specific API compatibility details

Adapters are implementation plumbing. They should not encode locator-family-specific advantages.

## App-Specific Locators

Per-app locator files live under `src/locators/apps/`:

- `angular-realworld.locators.ts`
- `shared-realworld.ts`
- `vue3-realworld.locators.ts`

The shared RealWorld locator shape lets the scenario code call logical keys such as `locators.auth.emailInput()` or `oracle.article.favoriteButton()` without knowing which application is under test.

## Subject App Documentation

Some application folders include upstream README files, changelogs, or framework notes. Those files document the apps themselves. Benchmark documentation belongs in this `docs/` folder.

When app documentation conflicts with benchmark behavior, treat benchmark source as authoritative.
