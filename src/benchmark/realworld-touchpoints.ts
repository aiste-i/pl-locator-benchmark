import type { Locator } from '@playwright/test';
import { getAppAdapter } from '../apps';
import type { SupportedAppId } from '../apps/types';
import { getByLogicalKey, getLocatorMeta, type LocatorFamilyMeta } from '../locators/apps/shared-realworld';
import { getImmediateElementHandle } from '../utils/locator-handles';

export type RelevanceBand =
  | 'exact-touchpoint'
  | 'touchpoint-descendant'
  | 'touchpoint-ancestor'
  | 'same-accessible-name-surface'
  | 'same-actionable-container'
  | 'same-collection-item'
  | 'generic';

export interface FamilyStressHints {
  semantic: boolean;
  css: boolean;
  xpath: boolean;
}

export interface TouchpointElementSnapshot {
  selector: string;
  stableSelector: string | null;
  tagType: string;
  role: string;
  accessibleNameSurfaceSelector: string | null;
  actionableContainerSelector: string | null;
  collectionItemSelector: string | null;
}

export interface ScenarioTouchpointInput {
  logicalKey: string;
  role: 'primary-action' | 'secondary-action' | 'assertion' | 'navigation' | 'context';
  locator: Locator;
}

export interface ScenarioTouchpoint {
  logicalKey: string;
  role: ScenarioTouchpointInput['role'];
  priority: number;
  resolvedTarget: TouchpointElementSnapshot;
  familyMeta: {
    semantic: LocatorFamilyMeta | null;
    css: LocatorFamilyMeta | null;
    xpath: LocatorFamilyMeta | null;
    oracle: LocatorFamilyMeta | null;
  };
}

export interface TargetRelevanceInput {
  selector: string;
  stableSelector: string | null;
  tagType: string;
  role: string;
  accessibleNameSurfaceSelector: string | null;
  actionableContainerSelector: string | null;
  collectionItemSelector: string | null;
}

export interface TargetRelevanceAnnotation {
  touchpointLogicalKeys: string[];
  relevanceBand: RelevanceBand;
  familyStressHints: FamilyStressHints;
  relevanceScore: number;
}

export interface MutationCategoryCompatibilityInput extends TargetRelevanceAnnotation {
  tagType: string;
  role: string;
}

const RELEVANCE_RANK: Record<Exclude<RelevanceBand, 'generic'>, number> = {
  'exact-touchpoint': 6,
  'touchpoint-descendant': 5,
  'touchpoint-ancestor': 4,
  'same-accessible-name-surface': 3,
  'same-actionable-container': 2,
  'same-collection-item': 1,
};

const ROLE_PRIORITY: Record<ScenarioTouchpointInput['role'], number> = {
  'primary-action': 40,
  assertion: 35,
  'secondary-action': 25,
  navigation: 15,
  context: 5,
};

function getLocatorFamilyMeta(appId: SupportedAppId, logicalKey: string, family: 'semantic-first' | 'css' | 'xpath' | 'oracle'): LocatorFamilyMeta | null {
  const adapter = getAppAdapter(appId);
  const tree = family === 'oracle' ? adapter.getOracle() : adapter.getLocators(family);
  return getLocatorMeta(getByLogicalKey(tree, logicalKey)) ?? null;
}

function compareSelectorPath(left: string, right: string): boolean {
  return left === right;
}

function selectorMatches(
  candidateSelector: string | null | undefined,
  candidateStableSelector: string | null | undefined,
  touchpointSelector: string,
  touchpointStableSelector: string | null | undefined,
): boolean {
  if (candidateSelector && compareSelectorPath(candidateSelector, touchpointSelector)) {
    return true;
  }
  if (candidateSelector && touchpointStableSelector && compareSelectorPath(candidateSelector, touchpointStableSelector)) {
    return true;
  }
  if (candidateStableSelector && compareSelectorPath(candidateStableSelector, touchpointSelector)) {
    return true;
  }
  if (candidateStableSelector && touchpointStableSelector && compareSelectorPath(candidateStableSelector, touchpointStableSelector)) {
    return true;
  }
  return false;
}

function isDescendantSelector(candidateSelector: string, touchpointSelector: string): boolean {
  return candidateSelector.startsWith(`${touchpointSelector} > `);
}

function isAncestorSelector(candidateSelector: string, touchpointSelector: string): boolean {
  return touchpointSelector.startsWith(`${candidateSelector} > `);
}

function familyStressForBand(
  band: RelevanceBand,
  touchpoint: ScenarioTouchpoint,
): FamilyStressHints {
  if (band === 'generic') {
    return {
      semantic: false,
      css: false,
      xpath: false,
    };
  }

  return {
    semantic: band !== 'same-collection-item' && Boolean(touchpoint.familyMeta.semantic),
    css: Boolean(touchpoint.familyMeta.css),
    xpath: Boolean(touchpoint.familyMeta.xpath),
  };
}

function pickBandForTouchpoint(target: TargetRelevanceInput, touchpoint: ScenarioTouchpoint): RelevanceBand {
  if (
    selectorMatches(
      target.selector,
      target.stableSelector,
      touchpoint.resolvedTarget.selector,
      touchpoint.resolvedTarget.stableSelector,
    )
  ) {
    return 'exact-touchpoint';
  }
  if (isDescendantSelector(target.selector, touchpoint.resolvedTarget.selector)) {
    return 'touchpoint-descendant';
  }
  if (isAncestorSelector(target.selector, touchpoint.resolvedTarget.selector)) {
    return 'touchpoint-ancestor';
  }
  if (
    target.accessibleNameSurfaceSelector &&
    touchpoint.resolvedTarget.accessibleNameSurfaceSelector &&
    target.accessibleNameSurfaceSelector === touchpoint.resolvedTarget.accessibleNameSurfaceSelector
  ) {
    return 'same-accessible-name-surface';
  }
  if (
    target.actionableContainerSelector &&
    touchpoint.resolvedTarget.actionableContainerSelector &&
    target.actionableContainerSelector === touchpoint.resolvedTarget.actionableContainerSelector
  ) {
    return 'same-actionable-container';
  }
  if (
    target.collectionItemSelector &&
    touchpoint.resolvedTarget.collectionItemSelector &&
    target.collectionItemSelector === touchpoint.resolvedTarget.collectionItemSelector
  ) {
    return 'same-collection-item';
  }
  return 'generic';
}

function scoreBand(band: RelevanceBand): number {
  return band === 'generic' ? 0 : RELEVANCE_RANK[band];
}

export async function snapshotTouchpointLocator(locator: Locator): Promise<TouchpointElementSnapshot | null> {
  const handle = await getImmediateElementHandle(locator);
  if (!handle) {
    return null;
  }

  try {
    return await handle.evaluate((node: Element) => {
      const getStableSelector = (element: Element): string | null => {
        const testId = element.getAttribute('data-testid');
        if (testId) {
          return `[data-testid="${testId}"]`;
        }
        if (element.id) {
          return `#${element.id}`;
        }
        return null;
      };

      const computeSelector = (element: Element): string => {
        const path: string[] = [];
        let current: Element | null = element;
        while (current && current !== document.body) {
          let selector = current.tagName.toLowerCase();
          if (current.parentElement) {
            const siblings = Array.from(current.parentElement.children).filter(child => child.tagName === current?.tagName);
            if (siblings.length > 1) {
              selector += `:nth-of-type(${siblings.indexOf(current) + 1})`;
            }
          }
          path.unshift(selector);
          current = current.parentElement;
        }
        return path.join(' > ');
      };

      const getPreferredSelector = (element: Element): string => getStableSelector(element) ?? computeSelector(element);

      const closestSelector = (element: Element, matcher: (candidate: Element) => boolean): string | null => {
        let current: Element | null = element;
        while (current && current !== document.body) {
          if (matcher(current)) {
            return getPreferredSelector(current);
          }
          current = current.parentElement;
        }
        return null;
      };

      const accessibleMatcher = (candidate: Element) =>
        ['button', 'a', 'label', 'input', 'textarea', 'select', 'option'].includes(candidate.tagName.toLowerCase()) ||
        /^h[1-6]$/.test(candidate.tagName.toLowerCase()) ||
        candidate.hasAttribute('aria-label') ||
        candidate.hasAttribute('aria-labelledby') ||
        candidate.hasAttribute('placeholder') ||
        candidate.hasAttribute('alt') ||
        candidate.hasAttribute('title') ||
        candidate.hasAttribute('role');

      const actionableMatcher = (candidate: Element) =>
        ['button', 'a', 'input', 'textarea', 'select', 'form'].includes(candidate.tagName.toLowerCase()) ||
        candidate.getAttribute('role') === 'button' ||
        candidate.getAttribute('role') === 'link';

      const collectionMatcher = (candidate: Element) =>
        ['article', 'li'].includes(candidate.tagName.toLowerCase()) ||
        candidate.tagName.toLowerCase().includes('app-article-preview') ||
        candidate.classList.contains('article-preview') ||
        candidate.classList.contains('card') ||
        candidate.getAttribute('data-testid')?.startsWith('comment-card-') === true;

      return {
        selector: computeSelector(node),
        stableSelector: getStableSelector(node),
        tagType: node.tagName.toLowerCase(),
        role: node.getAttribute('role') || '',
        accessibleNameSurfaceSelector: closestSelector(node, accessibleMatcher),
        actionableContainerSelector: closestSelector(node, actionableMatcher),
        collectionItemSelector: closestSelector(node, collectionMatcher),
      };
    });
  } finally {
    await handle.dispose().catch(() => undefined);
  }
}

export async function resolveScenarioTouchpoints(
  appId: SupportedAppId,
  scenarioId: string,
  inputs: ScenarioTouchpointInput[],
): Promise<ScenarioTouchpoint[]> {
  const resolved: ScenarioTouchpoint[] = [];

  for (const input of inputs) {
    const snapshot = await snapshotTouchpointLocator(input.locator);
    if (!snapshot) {
      continue;
    }
    resolved.push({
      logicalKey: input.logicalKey,
      role: input.role,
      priority: ROLE_PRIORITY[input.role],
      resolvedTarget: snapshot,
      familyMeta: {
        semantic: getLocatorFamilyMeta(appId, input.logicalKey, 'semantic-first'),
        css: getLocatorFamilyMeta(appId, input.logicalKey, 'css'),
        xpath: getLocatorFamilyMeta(appId, input.logicalKey, 'xpath'),
        oracle: getLocatorFamilyMeta(appId, input.logicalKey, 'oracle'),
      },
    });
  }

  return resolved.sort((left, right) => right.priority - left.priority || left.logicalKey.localeCompare(right.logicalKey));
}

export function annotateTargetRelevance(
  target: TargetRelevanceInput,
  touchpoints: ScenarioTouchpoint[],
): TargetRelevanceAnnotation {
  let bestBand: RelevanceBand = 'generic';
  let bestScore = 0;
  let bestStress: FamilyStressHints = { semantic: false, css: false, xpath: false };
  let bestLogicalKeys: string[] = [];

  for (const touchpoint of touchpoints) {
    const band = pickBandForTouchpoint(target, touchpoint);
    const familyStress = familyStressForBand(band, touchpoint);
    const score =
      scoreBand(band) * 100 +
      touchpoint.priority +
      Number(familyStress.semantic) * 5 +
      Number(familyStress.css) * 3 +
      Number(familyStress.xpath) * 3;

    if (score > bestScore) {
      bestScore = score;
      bestBand = band;
      bestStress = familyStress;
      bestLogicalKeys = [touchpoint.logicalKey];
      continue;
    }

    if (score === bestScore && score > 0 && !bestLogicalKeys.includes(touchpoint.logicalKey)) {
      bestLogicalKeys.push(touchpoint.logicalKey);
      bestStress = {
        semantic: bestStress.semantic || familyStress.semantic,
        css: bestStress.css || familyStress.css,
        xpath: bestStress.xpath || familyStress.xpath,
      };
    }
  }

  return {
    touchpointLogicalKeys: bestLogicalKeys.sort(),
    relevanceBand: bestBand,
    familyStressHints: bestStress,
    relevanceScore: bestScore,
  };
}

export function categoryAvailabilityHint(
  operatorCategory: string,
  target: MutationCategoryCompatibilityInput,
): boolean {
  if (operatorCategory === 'accessibility-semantic') {
    return (
      target.relevanceBand === 'exact-touchpoint' ||
      target.relevanceBand === 'touchpoint-descendant' ||
      target.relevanceBand === 'same-accessible-name-surface' ||
      ['button', 'a', 'input', 'textarea', 'label'].includes(target.tagType) ||
      /^h[1-6]$/.test(target.tagType) ||
      ['button', 'link', 'textbox'].includes(target.role)
    );
  }

  return target.relevanceBand !== 'generic';
}

export function countFamilyStressHints(hints: FamilyStressHints | undefined): number {
  if (!hints) {
    return 0;
  }
  return Number(hints.semantic) + Number(hints.css) + Number(hints.xpath);
}
