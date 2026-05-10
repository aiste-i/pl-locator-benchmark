import { Locator, Page } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { isOracleSafeVisible } from './operator-helpers';

const WRAPPER_SELECTOR = 'a, button, label, [role="button"], [role="link"]';

export class LinkTextUnwrap implements DomOperator {
  category: 'structural' = 'structural';

  async isApplicable(page: Page, target: Locator): Promise<boolean> {
    if (!await isOracleSafeVisible(target)) return false;
    return await target.evaluate((node: HTMLElement, selector: string) => {
      const container = node.matches(selector) ? node : node.closest(selector);
      if (!container) return false;
      return Array.from(container.children).some(child =>
        child.tagName.toLowerCase() === 'span' &&
        child.children.length === 0 &&
        (child.textContent?.trim().length ?? 0) > 0,
      );
    }, WRAPPER_SELECTOR);
  }

  async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
    const result = await target.evaluate((node: HTMLElement, selector: string) => {
      const container = (node.matches(selector) ? node : node.closest(selector)) as HTMLElement | null;
      if (!container) {
        return null;
      }

      const wrapper = Array.from(container.children).find(child =>
        child.tagName.toLowerCase() === 'span' &&
        child.children.length === 0 &&
        (child.textContent?.trim().length ?? 0) > 0,
      ) as HTMLElement | undefined;

      if (!wrapper || !wrapper.parentElement) {
        return null;
      }

      wrapper.replaceWith(document.createTextNode(wrapper.textContent ?? ''));
      return { unwrappedTag: 'span' };
    }, WRAPPER_SELECTOR);

    if (!result) {
      record.addError('Inline text wrapper could not be removed');
      return;
    }

    record.data = {
      type: 'LinkTextUnwrap',
      ...result,
    };
  }

  serialize(): { type: string; params?: any } {
    return { type: 'LinkTextUnwrap' };
  }
}
