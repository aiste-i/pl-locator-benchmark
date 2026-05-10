import { Locator, Page } from 'playwright';
import { AccessibilityOperator } from './AccessibilityOperator';
import { MutationRecord } from '../../../MutationRecord';
import { OracleSafety } from '../../../utils/OracleSafety';

export class LabelToPlaceholderFallback extends AccessibilityOperator {
  category: 'accessibility-semantic' = 'accessibility-semantic';
  oracleAnchorSafe = true;

  async isApplicable(page: Page, target: Locator): Promise<boolean> {
    if (!await super.isApplicable(page, target)) return false;
    if (await OracleSafety.isProtected(target)) return false;

    return await target.evaluate((node: HTMLElement) => {
      if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) return false;
      const label = node.labels?.[0];
      return Boolean(label?.textContent?.trim()) && !node.placeholder;
    });
  }

  async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
    const result = await target.evaluate((node: HTMLElement) => {
      if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) {
        return null;
      }

      const label = node.labels?.[0];
      const labelText = label?.textContent?.trim();
      if (!label || !labelText) {
        return null;
      }

      node.setAttribute('placeholder', labelText);
      node.removeAttribute('aria-labelledby');
      label.setAttribute('aria-hidden', 'true');
      label.removeAttribute('for');

      return {
        labelText,
      };
    });

    if (!result) {
      record.addError('Label could not be downgraded to placeholder fallback');
      return;
    }

    record.data = {
      type: 'LabelToPlaceholderFallback',
      ...result,
    };
  }
}
