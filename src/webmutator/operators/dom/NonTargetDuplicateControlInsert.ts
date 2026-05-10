import { Locator, Page } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { isOracleSafeVisible } from './operator-helpers';

const DUPLICABLE_CONTROL_SELECTOR = 'button, a[href], [role="button"], [role="link"]';

export class NonTargetDuplicateControlInsert implements DomOperator {
  category: 'structural' = 'structural';

  async isApplicable(page: Page, target: Locator): Promise<boolean> {
    if (!await isOracleSafeVisible(target)) return false;
    return await target.evaluate((node: HTMLElement, selector: string) => Boolean((node.matches(selector) ? node : node.closest(selector))?.parentElement), DUPLICABLE_CONTROL_SELECTOR);
  }

  async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
    const result = await target.evaluate((node: HTMLElement, selector: string) => {
      const control = (node.matches(selector) ? node : node.closest(selector)) as HTMLElement | null;
      const parent = control?.parentElement;
      if (!control || !parent) {
        return null;
      }

      const clone = control.cloneNode(true) as HTMLElement;
      clone.removeAttribute('id');
      clone.removeAttribute('data-testid');
      clone.setAttribute('aria-label', `${control.getAttribute('aria-label') || control.textContent?.trim() || 'control'} alternate`);
      if (clone instanceof HTMLButtonElement) {
        clone.type = 'button';
      }
      if (clone instanceof HTMLAnchorElement) {
        clone.setAttribute('href', '#/benchmark-alternate');
      }
      if (!clone.textContent?.trim()) {
        clone.textContent = 'Alternate';
      }
      parent.insertBefore(clone, control);

      return { duplicateTag: clone.tagName.toLowerCase() };
    }, DUPLICABLE_CONTROL_SELECTOR);

    if (!result) {
      record.addError('Duplicate control could not be inserted');
      return;
    }

    record.data = {
      type: 'NonTargetDuplicateControlInsert',
      ...result,
    };
  }

  serialize(): { type: string; params?: any } {
    return { type: 'NonTargetDuplicateControlInsert' };
  }
}
