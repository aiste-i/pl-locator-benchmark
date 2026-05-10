import type { Locator, Page } from 'playwright';
import type { DomOperator } from './dom/DomOperator';
import { OracleSafety } from '../utils/OracleSafety';

export type MutationSkipReason =
  | 'target-not-found'
  | 'oracle-protected'
  | 'behavior-preservation-gate-failed'
  | 'operator-applicability-error';

export interface MutationApplicabilityResult {
  applicable: boolean;
  reason: MutationSkipReason | null;
}

export async function evaluateMutationApplicability(
  page: Page,
  target: Locator,
  operator: DomOperator,
): Promise<MutationApplicabilityResult> {
  if (await target.count() === 0) {
    return { applicable: false, reason: 'target-not-found' };
  }

  const protectionKind = await OracleSafety.getProtectionKind(target);
  const directAnchorAllowed = protectionKind === 'direct-anchor' && operator.oracleAnchorSafe === true;
  if (protectionKind === 'contains-anchor-descendant' || (protectionKind === 'direct-anchor' && !directAnchorAllowed)) {
    return { applicable: false, reason: 'oracle-protected' };
  }

  try {
    const applicable = await operator.isApplicable(page, target);
    return applicable
      ? { applicable: true, reason: null }
      : { applicable: false, reason: 'behavior-preservation-gate-failed' };
  } catch {
    return { applicable: false, reason: 'operator-applicability-error' };
  }
}
