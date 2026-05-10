import { Locator, Page } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { isOracleSafeVisible } from './operator-helpers';

const TEXT_CONTAINER_SELECTOR = 'a, button, label, [role="button"], [role="link"]';

export class LinkTextWrapInSpan implements DomOperator {
  category: 'structural' = 'structural';

  async isApplicable(page: Page, target: Locator): Promise<boolean> {
    if (!await isOracleSafeVisible(target)) return false;
    return await target.evaluate((node: HTMLElement, selector: string) => {
      const container = node.matches(selector) ? node : node.closest(selector);
      if (!container) return false;
      return Array.from(container.childNodes).some(child => child.nodeType === Node.TEXT_NODE && (child.textContent?.trim().length ?? 0) > 0);
    }, TEXT_CONTAINER_SELECTOR);
  }

  async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
    const result = await target.evaluate((node: HTMLElement, selector: string) => {
      const container = (node.matches(selector) ? node : node.closest(selector)) as HTMLElement | null;
      if (!container) {
        return null;
      }

      let wrappedCount = 0;
      for (const child of Array.from(container.childNodes)) {
        if (child.nodeType !== Node.TEXT_NODE || (child.textContent?.trim().length ?? 0) === 0) {
          continue;
        }
        const wrapper = document.createElement('span');
        wrapper.setAttribute('data-benchmark-inline-wrap', 'true');
        wrapper.textContent = child.textContent ?? '';
        container.replaceChild(wrapper, child);
        wrappedCount += 1;
      }

      return wrappedCount > 0 ? { wrappedCount } : null;
    }, TEXT_CONTAINER_SELECTOR);

    if (!result) {
      record.addError('Direct text could not be wrapped');
      return;
    }

    record.data = {
      type: 'LinkTextWrapInSpan',
      ...result,
    };
  }

  serialize(): { type: string; params?: any } {
    return { type: 'LinkTextWrapInSpan' };
  }
}
