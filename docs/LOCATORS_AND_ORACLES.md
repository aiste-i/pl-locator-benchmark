# Locators And Oracles

The benchmark has two locator layers:

- benchmarked locator families, which are compared
- oracle locators, which provide independent ground truth

These layers stay separate throughout the benchmark.

## Benchmarked Families

The compared families are:

- `semantic-first`
- `css`
- `xpath`

The same scenario code runs for every family. Only the locator implementation returned by the fixture changes.

### Semantic-First

`semantic-first` locators must begin with a Playwright semantic API:

- `getByRole`
- `getByLabel`
- `getByText`
- `getByPlaceholder`
- `getByAltText`
- `getByTitle`

Follow-up narrowing is allowed only when it preserves the family rule and does not become an untracked CSS/XPath fallback.

### CSS

`css` locators use CSS selector resolution only. They are expected to represent traditional selector-heavy test code.

### XPath

`xpath` locators use XPath selector resolution only. They are kept visible as a separate family so XPath fragility can be measured instead of inferred.

## Logical Keys

Scenarios call logical keys rather than raw selectors. Example keys include:

- `auth.emailInput`
- `home.firstReadMoreLink`
- `article.favoriteButton`
- `comments.submitButton`
- `profile.followButton`
- `settings.bioInput`

Logical key definitions and coverage helpers live under `src/locators/realworld/`. Per-app implementations live under `src/locators/apps/`.

## Unsupported Cases

Unsupported family/app/key combinations are not hidden by fallback locators. They are reported through locator support artifacts and excluded from fair denominators when required.

Relevant reports:

- `reports/realworld-locator-support-matrix.json`
- `reports/realworld-locator-unsupported.json`
- `reports/realworld-semantic-css-exceptions.json`

The active RealWorld corpus should keep semantic CSS exceptions explicit and rare. If an exception is needed, document why the semantic API cannot express the comparable target directly.

## Lint And Validation Enforcement

`npm run lint` runs ESLint with the local `realworld-locator-purity` and `realworld-corpus-status` rules. The locator rule checks all RealWorld app locator trees:

- `semantic-first` entries must be semantic-native or explicitly documented CSS-backed semantic exceptions.
- native semantic entries must use one of the approved semantic entry points.
- `css` entries must have CSS family/source/purity metadata and must not use `data-testid`.
- `xpath` entries must have XPath family/source/purity metadata and must not use `data-testid`.
- oracle entries must use `getByTestId()` chain metadata.
- every active logical key must exist for every app and benchmark family.

`npm run validate:realworld` also runs Playwright validation specs, including `tests/realworld-validation/LocatorPurity.spec.ts`, which checks the same family rules through the test harness.

## Oracle Layer

Oracle locators are implemented through `getByTestId()` chains only. They are allowed to use dynamic test IDs for repeated entities, for example:

- `article-preview-1`
- `article-read-more-1`
- `comment-card-<id>`
- `pagination-item-<n>`
- `pagination-link-<n>`

Oracle locators must not use:

- `getByText(...)`
- `getByRole(...)`
- CSS selectors
- XPath selectors
- text filters
- generic `page.locator(...)` roots

This restriction prevents oracle drift from being confused with benchmark locator failure.

## Oracle Safety

Mutation safety protects oracle grounding in two ways:

- static validation rejects impure oracle source patterns
- runtime mutation filtering skips oracle nodes and oracle-critical ancestors

The runtime skip reason `oracle-protected` is expected and is not a bug by itself.

Some operators have a narrow direct-anchor-safe path. That path allows carefully bounded mutations on direct `data-testid` anchors only when oracle grounding remains intact. It exists because relevant RealWorld touchpoints are often strongly anchored for testability.

## Failure Classification

The benchmark wrappers record:

- locator resolution
- actionability
- assertion outcomes
- oracle integrity

Failure classes include:

- `NO_MATCH`
- `MULTIPLE_MATCH`
- `ACTIONABILITY`
- `ASSERTION`

Infrastructure, setup, mutation-application, and oracle-integrity failures become `invalid` records and stay outside locator-family failure-rate denominators.
