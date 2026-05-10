import path from 'path';
import type { RealWorldLogicalKey } from '../locators';
import type { SupportedAppId } from '../apps/types';
import type { SemanticEntryPoint } from '../locators/apps/shared-realworld';

export type RealWorldCorpusStatus =
  | 'active'
  | 'excluded-by-design'
  | 'excluded-unsupported-comparability'
  | 'excluded-methodological';

export type RealWorldSourceSpecStatus =
  | 'migrated'
  | 'excluded-by-design'
  | 'excluded-methodological';

export type RealWorldScenarioCategory =
  | 'load-visibility'
  | 'authentication'
  | 'content-access'
  | 'state-change';

export interface RealWorldScenarioEntry {
  scenarioId: string;
  displayName: string;
  sourceSpec: string;
  status: RealWorldCorpusStatus;
  reason: string;
  category: RealWorldScenarioCategory;
  requiresAuth: boolean;
  usesSetupData: boolean;
  logicalKeys: RealWorldLogicalKey[];
  aggregateComparisonEligible: boolean;
}

export interface RealWorldSourceSpecDisposition {
  sourceSpec: string;
  status: RealWorldSourceSpecStatus;
  rationale: string;
  activeScenarioIds: string[];
  excludedCoverage: string[];
}

export interface RealWorldCorpusManifest {
  corpusId: string;
  displayName: string;
  entrySpec: string;
  validationFiles: string[];
  scenarios: RealWorldScenarioEntry[];
  sourceSpecs: RealWorldSourceSpecDisposition[];
}

export const REALWORLD_ACTIVE_CORPUS_ID = 'realworld-active';
export const REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID = 'realworld-semantic-supplement';

export type RealWorldCorpusRole = 'primary' | 'supplementary';
export type SupplementFallbackPolicy = 'exclude-if-intended-query-unavailable';

export interface RealWorldSemanticSupplementScenarioEntry extends RealWorldScenarioEntry {
  corpusRole: 'supplementary';
  supportedApps: SupportedAppId[];
  excludedApps: Array<{
    appId: SupportedAppId;
    reason: string;
  }>;
  intendedSemanticEntryPoint: SemanticEntryPoint;
  targetLogicalKeys: RealWorldLogicalKey[];
  semanticNaturalnessRationale: string;
  supplementRationale: string;
  fallbackPolicy: SupplementFallbackPolicy;
  getByTitleOmissionRationale?: string;
}

export interface RealWorldSemanticSupplementManifest {
  corpusId: typeof REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID;
  displayName: string;
  corpusRole: 'supplementary';
  entrySpec: string;
  validationFiles: string[];
  interpretationBoundary: string;
  scenarios: RealWorldSemanticSupplementScenarioEntry[];
}

export const REALWORLD_CORPUS_MANIFEST: RealWorldCorpusManifest = {
  corpusId: REALWORLD_ACTIVE_CORPUS_ID,
  displayName: 'RealWorld Active Benchmark Corpus',
  entrySpec: 'tests/realworld/benchmark-active.spec.ts',
  validationFiles: [
    'tests/realworld/benchmark-active.spec.ts',
    'tests/realworld/benchmark-active.scenarios.ts',
    'tests/realworld/helpers/benchmark-active.ts',
  ],
  scenarios: [
    {
      scenarioId: 'health.home-load',
      displayName: 'Home loads',
      sourceSpec: 'tests/realworld/health.spec.ts',
      status: 'active',
      reason: 'Shared load and visibility verification across all three apps.',
      category: 'load-visibility',
      requiresAuth: false,
      usesSetupData: false,
      logicalKeys: ['nav.brandLink', 'nav.navbar'],
      aggregateComparisonEligible: true,
    },
    {
      scenarioId: 'auth.sign-in-valid',
      displayName: 'Sign in with valid credentials',
      sourceSpec: 'tests/realworld/auth.spec.ts',
      status: 'active',
      reason: 'Shared authentication task with non-benchmarked API setup and benchmarked UI sign-in.',
      category: 'authentication',
      requiresAuth: false,
      usesSetupData: true,
      logicalKeys: ['auth.emailInput', 'auth.passwordInput', 'auth.submitButton'],
      aggregateComparisonEligible: true,
    },
    {
      scenarioId: 'feed.open-global-feed',
      displayName: 'Open the global feed',
      sourceSpec: 'tests/realworld/navigation.spec.ts',
      status: 'active',
      reason: 'Shared content-access task present in Angular, Svelte, and Vue.',
      category: 'content-access',
      requiresAuth: false,
      usesSetupData: false,
      logicalKeys: ['nav.globalFeedTab'],
      aggregateComparisonEligible: true,
    },
    {
      scenarioId: 'article.open-from-feed',
      displayName: 'Open the first article from the feed',
      sourceSpec: 'tests/realworld/articles.spec.ts',
      status: 'active',
      reason: 'Shared article-access task using the dedicated read-more benchmark target rather than unsupported preview-description semantics.',
      category: 'content-access',
      requiresAuth: false,
      usesSetupData: false,
      logicalKeys: ['nav.globalFeedTab', 'home.firstReadMoreLink'],
      aggregateComparisonEligible: true,
    },
    {
      scenarioId: 'comments.add-on-article',
      displayName: 'Add a comment on an article',
      sourceSpec: 'tests/realworld/comments.spec.ts',
      status: 'active',
      reason: 'Shared comment-creation task that avoids the known Angular comment-delete semantic gap.',
      category: 'state-change',
      requiresAuth: true,
      usesSetupData: true,
      logicalKeys: ['nav.globalFeedTab', 'home.firstReadMoreLink', 'comments.textarea', 'comments.submitButton'],
      aggregateComparisonEligible: true,
    },
    {
      scenarioId: 'settings.update-bio',
      displayName: 'Update user bio in settings',
      sourceSpec: 'tests/realworld/settings.spec.ts',
      status: 'active',
      reason: 'Shared profile/settings update task with authenticated setup isolated from benchmark actions.',
      category: 'state-change',
      requiresAuth: true,
      usesSetupData: true,
      logicalKeys: ['settings.bioInput', 'settings.submitButton'],
      aggregateComparisonEligible: true,
    },
    {
      scenarioId: 'article.favorite-from-detail',
      displayName: 'Favorite an article from the detail page',
      sourceSpec: 'tests/realworld/articles.spec.ts',
      status: 'active',
      reason: 'Shared detail-page favorite flow using setup data and direct article routing so the benchmarked interaction stays on the article favorite control.',
      category: 'state-change',
      requiresAuth: true,
      usesSetupData: true,
      logicalKeys: ['article.favoriteButton'],
      aggregateComparisonEligible: true,
    },
    {
      scenarioId: 'article.preview-description-visibility',
      displayName: 'Verify article preview description',
      sourceSpec: 'tests/realworld/articles.spec.ts',
      status: 'active',
      reason: 'Shared article-preview visibility flow reached through app-owned tagged feed routing, with semantic-first CSS exceptions explicitly tracked in repo reports.',
      category: 'content-access',
      requiresAuth: false,
      usesSetupData: true,
      logicalKeys: ['home.previewDescription'],
      aggregateComparisonEligible: true,
    },
    {
      scenarioId: 'comments.delete-own',
      displayName: 'Delete own comment',
      sourceSpec: 'tests/realworld/comments.spec.ts',
      status: 'active',
      reason: 'Shared comment-deletion flow with article/comment setup handled off-path so the benchmarked interaction remains the delete control itself.',
      category: 'state-change',
      requiresAuth: true,
      usesSetupData: true,
      logicalKeys: ['comments.deleteButton'],
      aggregateComparisonEligible: true,
    },
    {
      scenarioId: 'article.assert-title',
      displayName: 'Assert article title through benchmark family',
      sourceSpec: 'tests/realworld/articles.spec.ts',
      status: 'active',
      reason: 'Shared article-title visibility flow reached through direct article routing so the benchmarked locator is the title itself rather than feed navigation.',
      category: 'content-access',
      requiresAuth: false,
      usesSetupData: true,
      logicalKeys: ['article.title'],
      aggregateComparisonEligible: true,
    },
    {
      scenarioId: 'navigation.pagination',
      displayName: 'Paginate long feed results',
      sourceSpec: 'tests/realworld/navigation.spec.ts',
      status: 'active',
      reason: 'Shared tag-feed pagination flow with setup data created via API and benchmarked page-navigation interactions.',
      category: 'content-access',
      requiresAuth: true,
      usesSetupData: true,
      logicalKeys: ['home.paginationButton', 'home.paginationItem'],
      aggregateComparisonEligible: true,
    },
    {
      scenarioId: 'social.follow-unfollow',
      displayName: 'Follow and unfollow another user',
      sourceSpec: 'tests/realworld/social.spec.ts',
      status: 'active',
      reason: 'Shared profile follow-toggle flow that uses authenticated setup data while keeping the benchmarked interaction on profile controls.',
      category: 'state-change',
      requiresAuth: true,
      usesSetupData: true,
      logicalKeys: ['profile.followButton', 'profile.unfollowButton'],
      aggregateComparisonEligible: true,
    },
    {
      scenarioId: 'security.xss-coverage',
      displayName: 'XSS and sanitization checks',
      sourceSpec: 'tests/realworld/xss-security.spec.ts',
      status: 'excluded-methodological',
      reason: 'Security assertions primarily probe sanitization guarantees rather than locator robustness, so they remain outside the active locator benchmark corpus.',
      category: 'content-access',
      requiresAuth: false,
      usesSetupData: true,
      logicalKeys: ['article.body', 'comments.card'],
      aggregateComparisonEligible: false,
    },
  ],
  sourceSpecs: [
    {
      sourceSpec: 'tests/realworld/health.spec.ts',
      status: 'migrated',
      rationale: 'The home-load baseline is fully migrated into the shared benchmark fixture and remains benchmark-active.',
      activeScenarioIds: ['health.home-load'],
      excludedCoverage: [],
    },
    {
      sourceSpec: 'tests/realworld/auth.spec.ts',
      status: 'migrated',
      rationale: 'The thesis-active auth benchmark retains the comparable sign-in task and excludes broader auth-state correctness checks that would compare session policy rather than locator robustness under UI change.',
      activeScenarioIds: ['auth.sign-in-valid'],
      excludedCoverage: [
        'registration and logout product flows',
        'invalid-credential and wrong-password error semantics',
        'session persistence and invalid-token recovery checks',
      ],
    },
    {
      sourceSpec: 'tests/realworld/articles.spec.ts',
      status: 'migrated',
      rationale: 'Comparable article-read and single-control state-change flows were migrated into the shared corpus; authoring and ownership workflows remain outside the thesis-active corpus because they compose many benchmarkable controls into one product-journey outcome.',
      activeScenarioIds: [
        'article.open-from-feed',
        'article.favorite-from-detail',
        'article.preview-description-visibility',
        'article.assert-title',
      ],
      excludedCoverage: [
        'create/edit/delete authoring workflows',
        'multi-field editor-tag manipulation',
        'authorization/ownership-only feature gating',
      ],
    },
    {
      sourceSpec: 'tests/realworld/comments.spec.ts',
      status: 'migrated',
      rationale: 'The shared corpus retains the comparable add-comment and delete-own-comment tasks and excludes broader correctness/edge-case checks that do not add distinct locator-family evidence.',
      activeScenarioIds: ['comments.add-on-article', 'comments.delete-own'],
      excludedCoverage: [
        'long-comment rendering and persistence checks',
        'login-gating correctness',
        'multiple-comment list presentation checks',
      ],
    },
    {
      sourceSpec: 'tests/realworld/navigation.spec.ts',
      status: 'migrated',
      rationale: 'The shared corpus keeps the directly comparable global-feed and pagination tasks; broader route-walk and tag-surface checks are excluded because they are application-navigation correctness checks or depend on backend-specific feed/sidebar behavior.',
      activeScenarioIds: ['feed.open-global-feed', 'navigation.pagination'],
      excludedCoverage: [
        'generic navbar route walking',
        'popular-tag surfacing and tag-filter correctness',
        'profile article-count presentation',
      ],
    },
    {
      sourceSpec: 'tests/realworld/settings.spec.ts',
      status: 'migrated',
      rationale: 'The active corpus benchmarks one controlled profile-update task and excludes orthogonal field-persistence variants whose value is product-correctness coverage rather than additional locator-family evidence.',
      activeScenarioIds: ['settings.update-bio'],
      excludedCoverage: [
        'image-only and multi-field update permutations',
        'navbar/profile persistence follow-up checks',
      ],
    },
    {
      sourceSpec: 'tests/realworld/social.spec.ts',
      status: 'migrated',
      rationale: 'The thesis-active corpus retains the comparable follow-toggle task while excluding broader profile/feed visibility assertions that primarily measure backend content state rather than a controlled locator-family interaction.',
      activeScenarioIds: ['social.follow-unfollow'],
      excludedCoverage: [
        'own-profile and other-profile display checks',
        'favorited-feed and followed-feed content assertions',
        'profile article listing correctness',
      ],
    },
    {
      sourceSpec: 'tests/realworld/error-handling.spec.ts',
      status: 'excluded-by-design',
      rationale: 'This spec focuses on API error handling and resilience semantics rather than controlled locator-family robustness under non-breaking UI change.',
      activeScenarioIds: [],
      excludedCoverage: ['error-surface behavior and failure recovery'],
    },
    {
      sourceSpec: 'tests/realworld/null-fields.spec.ts',
      status: 'excluded-by-design',
      rationale: 'Null-field normalization is backend/data-contract coverage rather than a locator robustness comparison task.',
      activeScenarioIds: [],
      excludedCoverage: ['nullable field rendering and persistence semantics'],
    },
    {
      sourceSpec: 'tests/realworld/url-navigation.spec.ts',
      status: 'excluded-by-design',
      rationale: 'URL-shape and deep-link routing checks validate navigation correctness, not locator-family robustness under injected UI change.',
      activeScenarioIds: [],
      excludedCoverage: ['deep-link and route-shape correctness'],
    },
    {
      sourceSpec: 'tests/realworld/user-fetch-errors.spec.ts',
      status: 'excluded-by-design',
      rationale: 'User-fetch failure handling probes infrastructure and resilience semantics, not the controlled UI-mutation question of the thesis benchmark.',
      activeScenarioIds: [],
      excludedCoverage: ['backend unavailability and auth-fetch recovery'],
    },
    {
      sourceSpec: 'tests/realworld/xss-security.spec.ts',
      status: 'excluded-methodological',
      rationale: 'Security and sanitization checks remain intentionally outside the thesis-active corpus because they address application security guarantees rather than locator robustness.',
      activeScenarioIds: [],
      excludedCoverage: ['XSS and sanitization coverage'],
    },
  ],
};

export const REALWORLD_SEMANTIC_SUPPLEMENT_MANIFEST: RealWorldSemanticSupplementManifest = {
  corpusId: REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
  displayName: 'RealWorld Semantic Supplement Corpus',
  corpusRole: 'supplementary',
  entrySpec: 'tests/realworld/benchmark-semantic-supplement.spec.ts',
  validationFiles: [
    'tests/realworld/benchmark-semantic-supplement.spec.ts',
    'tests/realworld/benchmark-semantic-supplement.scenarios.ts',
    'tests/realworld/helpers/benchmark-active.ts',
  ],
  interpretationBoundary:
    'Supplementary semantic-query coverage only; not pooled into the realworld-active thesis denominators.',
  scenarios: [
    {
      scenarioId: 'semantic.auth-email-label',
      displayName: 'Fill sign-in email by accessible label',
      sourceSpec: 'tests/realworld/auth.spec.ts',
      status: 'active',
      reason: 'Vue exposes the sign-in email control with a stable aria-label, making getByLabel the natural user-facing contract.',
      category: 'authentication',
      requiresAuth: false,
      usesSetupData: true,
      logicalKeys: ['auth.emailLabelInput'],
      aggregateComparisonEligible: true,
      corpusRole: 'supplementary',
      supportedApps: ['vue3-realworld-example-app'],
      excludedApps: [
        {
          appId: 'angular-realworld-example-app',
          reason: 'The Angular sign-in email field is placeholder-only and has no genuine label contract.',
        },
        {
          appId: 'realworld',
          reason: 'The Svelte sign-in email field is placeholder-only and has no genuine label contract.',
        },
      ],
      intendedSemanticEntryPoint: 'getByLabel',
      targetLogicalKeys: ['auth.emailLabelInput'],
      semanticNaturalnessRationale:
        'Accessible labels are the user-facing contract for labeled form controls; Vue provides this via aria-label.',
      supplementRationale:
        'The main corpus naturally exercises sign-in through placeholder/role locators, so this scenario isolates label-based semantic behavior.',
      fallbackPolicy: 'exclude-if-intended-query-unavailable',
    },
    {
      scenarioId: 'semantic.comment-placeholder',
      displayName: 'Fill article comment by placeholder',
      sourceSpec: 'tests/realworld/comments.spec.ts',
      status: 'active',
      reason: 'The comment textarea is consistently exposed with the visible placeholder "Write a comment..." across the three apps.',
      category: 'state-change',
      requiresAuth: true,
      usesSetupData: true,
      logicalKeys: ['comments.textarea'],
      aggregateComparisonEligible: true,
      corpusRole: 'supplementary',
      supportedApps: ['angular-realworld-example-app', 'realworld', 'vue3-realworld-example-app'],
      excludedApps: [],
      intendedSemanticEntryPoint: 'getByPlaceholder',
      targetLogicalKeys: ['comments.textarea'],
      semanticNaturalnessRationale:
        'The textarea lacks a stronger shared label contract, while the placeholder is stable, visible, and usable as a fallback contract.',
      supplementRationale:
        'The main corpus includes comment creation, but this scenario explicitly reports placeholder-query coverage as supplementary evidence.',
      fallbackPolicy: 'exclude-if-intended-query-unavailable',
    },
    {
      scenarioId: 'semantic.article-title-text',
      displayName: 'Assert article title by visible text',
      sourceSpec: 'tests/realworld/articles.spec.ts',
      status: 'active',
      reason: 'An API-provisioned article title is visible content whose text is the intended user-facing assertion contract.',
      category: 'content-access',
      requiresAuth: false,
      usesSetupData: true,
      logicalKeys: ['article.titleText'],
      aggregateComparisonEligible: true,
      corpusRole: 'supplementary',
      supportedApps: ['angular-realworld-example-app', 'realworld', 'vue3-realworld-example-app'],
      excludedApps: [],
      intendedSemanticEntryPoint: 'getByText',
      targetLogicalKeys: ['article.titleText'],
      semanticNaturalnessRationale:
        'The scenario asserts content whose visible string is the contract; getByText expresses that directly.',
      supplementRationale:
        'The primary title assertion uses the family-standard title locator; this supplementary case isolates text-query evidence.',
      fallbackPolicy: 'exclude-if-intended-query-unavailable',
    },
    {
      scenarioId: 'semantic.profile-avatar-alt',
      displayName: 'Assert profile avatar by alternative text',
      sourceSpec: 'tests/realworld/null-fields.spec.ts',
      status: 'active',
      reason: 'Svelte and Vue expose profile avatars with alt text equal to the username, making getByAltText a natural image locator.',
      category: 'content-access',
      requiresAuth: false,
      usesSetupData: true,
      logicalKeys: ['profile.avatarImage'],
      aggregateComparisonEligible: true,
      corpusRole: 'supplementary',
      supportedApps: ['realworld', 'vue3-realworld-example-app'],
      excludedApps: [
        {
          appId: 'angular-realworld-example-app',
          reason: 'The Angular profile avatar image has no stable alt text, so getByAltText would be artificial.',
        },
      ],
      intendedSemanticEntryPoint: 'getByAltText',
      targetLogicalKeys: ['profile.avatarImage'],
      semanticNaturalnessRationale:
        'Alternative text is the user-facing contract for meaningful images and is present on the profile avatar in Svelte and Vue.',
      supplementRationale:
        'The active corpus does not benchmark image alternative-text queries, so this scenario adds bounded supplementary coverage.',
      fallbackPolicy: 'exclude-if-intended-query-unavailable',
      getByTitleOmissionRationale:
        'No stable title-driven target was found that would be a natural RealWorld benchmark locator.',
    },
  ],
};

export function getBenchmarkCorpusId(): string | undefined {
  return process.env.BENCHMARK_CORPUS_ID || undefined;
}

export function getBenchmarkCorpusRole(corpusId = getBenchmarkCorpusId()): RealWorldCorpusRole | undefined {
  if (corpusId === REALWORLD_ACTIVE_CORPUS_ID) {
    return 'primary';
  }
  if (corpusId === REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID) {
    return 'supplementary';
  }
  return undefined;
}

export function usesDeferredMutation(corpusId = getBenchmarkCorpusId()): boolean {
  return corpusId === REALWORLD_ACTIVE_CORPUS_ID || corpusId === REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID;
}

export function requiresMandatoryCategoryCoverage(corpusId = getBenchmarkCorpusId()): boolean {
  return corpusId === REALWORLD_ACTIVE_CORPUS_ID;
}

export function getBenchmarkEntrySpecAbsolutePath(): string {
  return path.join(process.cwd(), REALWORLD_CORPUS_MANIFEST.entrySpec);
}

export function getActiveScenarioEntries(): RealWorldScenarioEntry[] {
  return REALWORLD_CORPUS_MANIFEST.scenarios.filter(entry => entry.status === 'active');
}

export function getSemanticSupplementScenarioEntries(): RealWorldSemanticSupplementScenarioEntry[] {
  return REALWORLD_SEMANTIC_SUPPLEMENT_MANIFEST.scenarios.filter(entry => entry.status === 'active');
}

export function getSemanticSupplementScenarioEntriesForApp(appId: SupportedAppId): RealWorldSemanticSupplementScenarioEntry[] {
  return getSemanticSupplementScenarioEntries().filter(entry => entry.supportedApps.includes(appId));
}

export function getSemanticSupplementExcludedPairs(): Array<{
  corpusId: string;
  scenarioId: string;
  appId: SupportedAppId;
  intendedSemanticEntryPoint: SemanticEntryPoint;
  reason: string;
}> {
  return getSemanticSupplementScenarioEntries().flatMap(entry =>
    entry.excludedApps.map(exclusion => ({
      corpusId: REALWORLD_SEMANTIC_SUPPLEMENT_CORPUS_ID,
      scenarioId: entry.scenarioId,
      appId: exclusion.appId,
      intendedSemanticEntryPoint: entry.intendedSemanticEntryPoint,
      reason: exclusion.reason,
    })),
  );
}

export function getExcludedScenarioEntries(): RealWorldScenarioEntry[] {
  return REALWORLD_CORPUS_MANIFEST.scenarios.filter(entry => entry.status !== 'active');
}

export function getSourceSpecDispositions(): RealWorldSourceSpecDisposition[] {
  return REALWORLD_CORPUS_MANIFEST.sourceSpecs;
}

export function getActiveScenarioIds(): string[] {
  return getActiveScenarioEntries().map(entry => entry.scenarioId);
}

export function getActiveSourceSpecs(): string[] {
  return [...new Set(getActiveScenarioEntries().map(entry => entry.sourceSpec))].sort();
}

export function getActiveLogicalKeys(): RealWorldLogicalKey[] {
  return [...new Set(getActiveScenarioEntries().flatMap(entry => entry.logicalKeys))] as RealWorldLogicalKey[];
}

export function getSemanticSupplementLogicalKeys(): RealWorldLogicalKey[] {
  return [...new Set(getSemanticSupplementScenarioEntries().flatMap(entry => entry.logicalKeys))] as RealWorldLogicalKey[];
}
