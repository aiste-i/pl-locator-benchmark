# Corpus And Scenarios

The active benchmark corpus is `realworld-active`.

Authoritative source:

- `src/benchmark/realworld-corpus.ts`
- `tests/realworld/benchmark-active.spec.ts`
- `tests/realworld/benchmark-active.scenarios.ts`

The corpus is shared across the three RealWorld apps and is designed to isolate locator-family robustness rather than broad product correctness.

## Active Scenarios

The active corpus contains 12 scenarios:

| Scenario ID | Category | Source Spec | Primary Surface |
| --- | --- | --- | --- |
| `health.home-load` | `load-visibility` | `health.spec.ts` | home page load and navbar visibility |
| `auth.sign-in-valid` | `authentication` | `auth.spec.ts` | login form fields and submit button |
| `feed.open-global-feed` | `content-access` | `navigation.spec.ts` | global feed tab |
| `article.open-from-feed` | `content-access` | `articles.spec.ts` | first article read-more link |
| `article.favorite-from-detail` | `state-change` | `articles.spec.ts` | article favorite button |
| `article.preview-description-visibility` | `content-access` | `articles.spec.ts` | preview description visibility |
| `navigation.pagination` | `content-access` | `navigation.spec.ts` | feed pagination control |
| `comments.add-on-article` | `state-change` | `comments.spec.ts` | comment textarea and submit button |
| `comments.delete-own` | `state-change` | `comments.spec.ts` | own-comment delete control |
| `article.assert-title` | `content-access` | `articles.spec.ts` | article title assertion |
| `social.follow-unfollow` | `state-change` | `social.spec.ts` | profile follow toggle |
| `settings.update-bio` | `state-change` | `settings.spec.ts` | settings bio field and submit button |

Categories are coarse by design. They group similar tasks without turning the benchmark into a product-feature coverage suite.

## Scenario Shape

Each scenario definition has two functions:

- `collect(...)`: navigates to the checkpoint and records reachable mutation targets.
- `run(...)`: executes the actual benchmark task and applies a deferred mutation at the named checkpoint.

This split lets the runner discover and preflight mutations at the same page state where they will later be applied.

## Setup Data

Some scenarios use API or storage setup to reach a comparable state:

- auth credentials
- authenticated users
- article/comment data
- profile or feed state

Setup stays off the measured path when possible. The measured interaction should be the selected UI task, not multi-step data provisioning.

## Source-Spec Dispositions

Every RealWorld source spec is classified in the corpus manifest:

- `migrated`: at least one comparable task was moved into the shared active corpus.
- `excluded-by-design`: the spec measures behavior outside the locator-robustness question.
- `excluded-methodological`: the spec does not fit the benchmark question.

Current explicit exclusions include:

- `error-handling.spec.ts`: API error and resilience semantics.
- `null-fields.spec.ts`: backend/data-contract normalization.
- `url-navigation.spec.ts`: route shape and deep-link behavior.
- `user-fetch-errors.spec.ts`: infrastructure and fetch-recovery behavior.
- `xss-security.spec.ts`: sanitization and security guarantees.

The XSS/security spec is excluded because it tests sanitization guarantees rather than locator-family behavior under UI mutation.

The source-spec files are provenance for corpus migration decisions. They are not part of the active benchmark execution path. The benchmark process runs `tests/realworld/benchmark-active.spec.ts`; validation runs `tests/realworld-validation/**/*.spec.ts`.

## Generated Corpus Reports

Run:

```bash
npm run reports:generate:source
```

Key outputs:

- `reports/realworld-benchmark-corpus.json`

This report lists active scenarios, excluded coverage, source-spec rationale, and corpus metadata.
