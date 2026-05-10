import { Locator, Page } from 'playwright';
import { AccessibilityOperator } from './AccessibilityOperator';
import { MutationRecord } from '../../../MutationRecord';
import { OracleSafety } from '../../../utils/OracleSafety';

export class LabelMechanismRewrite extends AccessibilityOperator {
  category: 'accessibility-semantic' = 'accessibility-semantic';
  oracleAnchorSafe = true;

  async isApplicable(page: Page, target: Locator): Promise<boolean> {
    if (!await super.isApplicable(page, target)) return false;
    if (await OracleSafety.isProtected(target)) return false;

    return await target.evaluate((node: HTMLElement) => {
      if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement)) {
        return false;
      }
      return Boolean(node.labels?.[0]);
    });
  }

  async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
    const result = await target.evaluate((node: HTMLElement) => {
      if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement)) {
        return null;
      }

      const label = node.labels?.[0];
      if (!label) {
        return null;
      }

      let span = label.querySelector('[data-benchmark-label-source="true"]') as HTMLElement | null;
      if (!span) {
        span = document.createElement('span');
        span.setAttribute('data-benchmark-label-source', 'true');
        span.textContent = label.textContent?.trim() ?? '';
        label.insertBefore(span, label.firstChild);
      }

      if (!span.id) {
        span.id = `benchmark-label-source-${Math.random().toString(36).slice(2, 10)}`;
      }

      node.setAttribute('aria-labelledby', span.id);
      label.removeAttribute('for');

      return {
        labelId: span.id,
        labelText: span.textContent ?? '',
      };
    });

    if (!result) {
      record.addError('Label mechanism rewrite could not be applied');
      return;
    }

    record.data = {
      type: 'LabelMechanismRewrite',
      ...result,
    };
  }
}
