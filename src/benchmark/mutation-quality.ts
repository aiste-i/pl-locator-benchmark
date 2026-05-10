import type { RelevanceBand } from './realworld-touchpoints';

export interface MutationSurfaceSnapshot {
  exists: boolean;
  tagType: string | null;
  textContent: string | null;
  className: string | null;
  style: string | null;
  role: string | null;
  ariaLabel: string | null;
  ariaLabelledBy: string | null;
  placeholder: string | null;
  alt: string | null;
  title: string | null;
  id: string | null;
  htmlFor: string | null;
  hidden: boolean | null;
  childElementCount: number | null;
  textNodeCount: number | null;
  parentSelector: string | null;
}

export interface MutationMeaningfulnessResult {
  meaningful: boolean;
  reason: string | null;
}

function hasRelevance(band: RelevanceBand | undefined): boolean {
  return Boolean(band && band !== 'generic');
}

export function evaluateMutationMeaningfulness(
  category: string,
  relevanceBand: RelevanceBand | undefined,
  before: MutationSurfaceSnapshot | null,
  after: MutationSurfaceSnapshot | null,
): MutationMeaningfulnessResult {
  if (!hasRelevance(relevanceBand)) {
    return {
      meaningful: false,
      reason: 'relevance-too-weak',
    };
  }

  if (!before || !before.exists) {
    return {
      meaningful: false,
      reason: 'missing-pre-mutation-snapshot',
    };
  }

  if (category === 'structural') {
    if (!after || !after.exists) {
      return { meaningful: true, reason: null };
    }
    const changed =
      before.tagType !== after.tagType ||
      before.parentSelector !== after.parentSelector ||
      before.childElementCount !== after.childElementCount ||
      before.className !== after.className ||
      before.style !== after.style ||
      before.textContent !== after.textContent;
    return {
      meaningful: changed,
      reason: changed ? null : 'structural-no-op',
    };
  }

  if (!after || !after.exists) {
    return {
      meaningful: false,
      reason: 'target-missing-after-nonstructural-mutation',
    };
  }

  if (category === 'content') {
    const changed =
      before.textContent !== after.textContent ||
      before.textNodeCount !== after.textNodeCount ||
      before.childElementCount !== after.childElementCount;
    return {
      meaningful: changed,
      reason: changed ? null : 'content-no-op',
    };
  }

  if (category === 'visibility') {
    const changed =
      before.className !== after.className ||
      before.style !== after.style ||
      before.hidden !== after.hidden ||
      before.ariaLabel !== after.ariaLabel;
    return {
      meaningful: changed,
      reason: changed ? null : 'visibility-no-op',
    };
  }

  if (category === 'accessibility-semantic') {
    const changed =
      before.tagType !== after.tagType ||
      before.role !== after.role ||
      before.ariaLabel !== after.ariaLabel ||
      before.ariaLabelledBy !== after.ariaLabelledBy ||
      before.placeholder !== after.placeholder ||
      before.alt !== after.alt ||
      before.title !== after.title ||
      before.id !== after.id ||
      before.htmlFor !== after.htmlFor ||
      before.textContent !== after.textContent;
    return {
      meaningful: changed,
      reason: changed ? null : 'accessibility-semantic-no-op',
    };
  }

  const changed =
    before.tagType !== after.tagType ||
    before.textContent !== after.textContent ||
    before.className !== after.className ||
    before.style !== after.style;
  return {
    meaningful: changed,
    reason: changed ? null : 'mutation-no-op',
  };
}
