import { Locator, Page } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { isOracleSafeVisible } from './operator-helpers';

const DECORATION_TARGET_SELECTOR = 'a, button, label, h1, h2, h3, h4, h5, h6, p, [role="button"], [role="link"]';

export class DecorativePrefixInsert implements DomOperator {
  category: 'content' = 'content';

  async isApplicable(page: Page, target: Locator): Promise<boolean> {
    if (!await isOracleSafeVisible(target)) return false;
    return await target.evaluate((node: HTMLElement, selector: string) => Boolean(node.matches(selector) || node.closest(selector)), DECORATION_TARGET_SELECTOR);
  }

  async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
    const result = await target.evaluate((node: HTMLElement, selector: string) => {
      const container = (node.matches(selector) ? node : node.closest(selector)) as HTMLElement | null;
      if (!container) {
        return null;
      }

      const prefix = document.createElement('span');
      prefix.setAttribute('aria-hidden', 'true');
      prefix.setAttribute('data-benchmark-decoration', 'prefix');
      prefix.textContent = '• ';
      container.insertBefore(prefix, container.firstChild);
      return { decoration: 'prefix' };
    }, DECORATION_TARGET_SELECTOR);

    if (!result) {
      record.addError('Decorative prefix could not be inserted');
      return;
    }

    record.data = {
      type: 'DecorativePrefixInsert',
      ...result,
    };
  }

  serialize(): { type: string; params?: any } {
    return { type: 'DecorativePrefixInsert' };
  }
}
