# RealWorld Semantic Target Audit

This audit defines a small supplementary semantic-coverage corpus. It is not part of the primary `realworld-active` denominator.

| Scenario | Apps | Intended Query | Target | Rationale |
| --- | --- | --- | --- | --- |
| `semantic.auth-email-label` | `vue3-realworld-example-app` | `getByLabel` | `auth.emailLabelInput` | Accessible labels are the user-facing contract for labeled form controls; Vue provides this via aria-label. |
| `semantic.comment-placeholder` | `angular-realworld-example-app`, `realworld`, `vue3-realworld-example-app` | `getByPlaceholder` | `comments.textarea` | The textarea lacks a stronger shared label contract, while the placeholder is stable, visible, and usable as a fallback contract. |
| `semantic.article-title-text` | `angular-realworld-example-app`, `realworld`, `vue3-realworld-example-app` | `getByText` | `article.titleText` | The scenario asserts content whose visible string is the contract; getByText expresses that directly. |
| `semantic.profile-avatar-alt` | `realworld`, `vue3-realworld-example-app` | `getByAltText` | `profile.avatarImage` | Alternative text is the user-facing contract for meaningful images and is present on the profile avatar in Svelte and Vue. |

## Exclusions

- `semantic.auth-email-label` excludes `angular-realworld-example-app`: The Angular sign-in email field is placeholder-only and has no genuine label contract.
- `semantic.auth-email-label` excludes `realworld`: The Svelte sign-in email field is placeholder-only and has no genuine label contract.
- `semantic.profile-avatar-alt` excludes `angular-realworld-example-app`: The Angular profile avatar image has no stable alt text, so getByAltText would be artificial.

## getByTitle Decision

No stable title-driven target was found that would be a natural RealWorld benchmark locator.
