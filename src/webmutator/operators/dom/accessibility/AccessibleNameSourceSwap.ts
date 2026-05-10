import { Locator, Page } from 'playwright';
import { AccessibilityOperator } from './AccessibilityOperator';
import { MutationRecord } from '../../../MutationRecord';
import { OracleSafety } from '../../../utils/OracleSafety';

const ACCESSIBLE_NAME_SELECTOR = 'button, a[href], [role="button"], [role="link"], input, textarea';

export class AccessibleNameSourceSwap extends AccessibilityOperator {
  category: 'accessibility-semantic' = 'accessibility-semantic';
  oracleAnchorSafe = true;

  async isApplicable(page: Page, target: Locator): Promise<boolean> {
    if (!await super.isApplicable(page, target)) return false;
    if (await OracleSafety.isProtected(target)) return false;

    return await target.evaluate((node: HTMLElement, selector: string) => {
      const control = node.matches(selector) ? node : node.closest(selector);
      if (!control) return false;
      return Boolean(control.getAttribute('aria-label') || control.textContent?.trim());
    }, ACCESSIBLE_NAME_SELECTOR);
  }

  async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
    const result = await target.evaluate((node: HTMLElement, selector: string) => {
      const control = (node.matches(selector) ? node : node.closest(selector)) as HTMLElement | null;
      if (!control) {
        return null;
      }

      const text = control.textContent?.trim() ?? '';
      const ariaLabel = control.getAttribute('aria-label');

      if (!ariaLabel && text) {
        control.setAttribute('aria-label', text);
        Array.from(control.childNodes).forEach(child => {
          if (child.nodeType === Node.TEXT_NODE && (child.textContent?.trim().length ?? 0) > 0) {
            const wrapper = document.createElement('span');
            wrapper.setAttribute('aria-hidden', 'true');
            wrapper.textContent = child.textContent ?? '';
            control.replaceChild(wrapper, child);
          }
        });
        return { from: 'visible-text', to: 'aria-label', name: text };
      }

      if (ariaLabel) {
        const span = document.createElement('span');
        span.textContent = ariaLabel;
        control.insertBefore(span, control.firstChild);
        control.removeAttribute('aria-label');
        return { from: 'aria-label', to: 'visible-text', name: ariaLabel };
      }

      return null;
    }, ACCESSIBLE_NAME_SELECTOR);

    if (!result) {
      record.addError('Accessible name source could not be swapped');
      return;
    }

    record.data = {
      type: 'AccessibleNameSourceSwap',
      ...result,
    };
  }
}
