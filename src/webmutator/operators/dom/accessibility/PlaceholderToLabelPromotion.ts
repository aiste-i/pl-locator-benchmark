import { Locator, Page } from 'playwright';
import { AccessibilityOperator } from './AccessibilityOperator';
import { MutationRecord } from '../../../MutationRecord';
import { OracleSafety } from '../../../utils/OracleSafety';

export class PlaceholderToLabelPromotion extends AccessibilityOperator {
  category: 'accessibility-semantic' = 'accessibility-semantic';
  oracleAnchorSafe = true;

  async isApplicable(page: Page, target: Locator): Promise<boolean> {
    if (!await super.isApplicable(page, target)) return false;
    if (await OracleSafety.isProtected(target)) return false;

    return await target.evaluate((node: HTMLElement) => {
      if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) return false;
      return Boolean(node.placeholder?.trim()) && !(node.labels?.length ?? 0) && !node.getAttribute('aria-labelledby');
    });
  }

  async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
    const result = await target.evaluate((node: HTMLElement) => {
      if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) {
        return null;
      }

      const labelText = node.placeholder?.trim();
      if (!labelText || !node.parentElement) {
        return null;
      }

      if (!node.id) {
        node.id = `benchmark-input-${Math.random().toString(36).slice(2, 10)}`;
      }

      const label = document.createElement('label');
      label.setAttribute('for', node.id);
      label.textContent = labelText;
      node.parentElement.insertBefore(label, node);
      node.removeAttribute('placeholder');
      node.setAttribute('aria-labelledby', label.id || '');
      if (!label.id) {
        label.id = `benchmark-label-${Math.random().toString(36).slice(2, 10)}`;
        node.setAttribute('aria-labelledby', label.id);
      }

      return {
        labelId: label.id,
        labelText,
      };
    });

    if (!result) {
      record.addError('Placeholder could not be promoted to label');
      return;
    }

    record.data = {
      type: 'PlaceholderToLabelPromotion',
      ...result,
    };
  }
}
