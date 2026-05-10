# Mutation Operators

The operator catalog defines which UI changes are available to the benchmark and how each maps to a mutation category.

Authoritative source:

- `src/webmutator/operators/catalog.ts`

Generated reports:

- `reports/realworld-operator-taxonomy.json`

## Categories

The in-scope categories are:

- `structural`
- `content`
- `accessibility-semantic`
- `visibility-interaction-state`

The runtime DOM category `visibility` is reported as `visibility-interaction-state` in aggregate outputs.

Visual-only operators exist in code but are marked `excluded-by-design`. They are not sampled into the active corpus.

## Structural Operators

Structural operators change DOM shape while preserving the task surface:

- attribute add/delete/replace/mutate operators
- subtree delete/insert/move/swap operators
- wrapper insert/remove operators
- ancestor lift/sink operators
- sibling or card lookalike insertion
- metadata child shuffle
- link text wrap/unwrap
- reverse/swap child ordering
- tag and container node mutations
- non-target duplicate control insertion

Structural operators are guarded against destructive changes to oracle roots, required controls, form-critical areas, and interactive descendants.

## Content Operators

Content operators mutate visible text while keeping the target present:

- `TextDelete`
- `TextInsert`
- `TextNodeMutator`
- `TextReplace`
- `SplitTextNode`
- `MergeAdjacentTextNodes`
- `DecorativePrefixInsert`
- `DecorativeSuffixInsert`

These operators are useful for testing locators that depend on exact text or nearby text structure.

## Accessibility-Semantic Operators

Accessibility-semantic operators target surfaces used by semantic Playwright locators:

- accessible names
- labels and label mechanisms
- placeholder text
- image alt text
- anchors, headings, table headers, landmarks
- ARIA labels and expanded state
- duplicate IDs and accessible-name source swaps

Examples:

- `ChangeButtonLabel`
- `MutateAccessibleNameText`
- `MutatePlaceholderText`
- `RemovePlaceholderText`
- `LabelMechanismRewrite`
- `AccessibleNameSourceSwap`
- `PlaceholderToLabelPromotion`
- `LabelToPlaceholderFallback`
- `ReplaceAnchorWithSpan`
- `ReplaceHeadingWithP`
- `SemanticToDiv`
- `ToggleAriaExpanded`

These operators are benchmarked across all families, not only `semantic-first`.

## Visibility And Interaction-State Operators

Visibility/interaction-state operators use bounded style or class changes:

- `StyleColor`
- `StylePosition`
- `StyleSize`
- `StyleVisibility`
- `ToggleCssClass`

They are intended to stress assumptions about visibility and actionability while preserving the benchmark task.

## Excluded Visual Operators

The catalog includes visual-only operators:

- `DistortMutator`
- `MaskMutator`

They are excluded because bitmap-style visual distortion is a different research question from DOM/accessibility locator robustness.

## Applicability And Safety

Every operator has:

- DOM applicability conditions
- a safety guard description
- runtime applicability checks
- oracle-safety filtering

Rejected candidates are reported rather than silently hidden. Common skip or rejection reasons include:

- `oracle-protected`
- `target-not-found`
- `behavior-preservation-gate-failed`
- `operator-applicability-error`
- `checkpoint-not-reached`
- `setup-failure`

## Telemetry

Mutated runs can include telemetry for:

- selected candidate id
- selected target selector
- target tag type
- runtime category
- category
- considered candidate count
- applicable candidate count
- oracle-skipped count
- apply duration
- final mutation outcome class

Aggregation writes this to:

- `mutation_run_telemetry.csv`
- `operator_telemetry_summary.csv`
