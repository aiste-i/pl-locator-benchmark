import { Locator, Page } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { isOracleSafeVisible } from './operator-helpers';

const DECORATION_TARGET_SELECTOR = 'a, button, label, h1, h2, h3, h4, h5, h6, p, [role="button"], [role="link"]';

export class DecorativeSuffixInsert implements DomOperator {
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

      const suffix = document.createElement('span');
      suffix.setAttribute('aria-hidden', 'true');
      suffix.setAttribute('data-benchmark-decoration', 'suffix');
      suffix.textContent = ' •';
      container.appendChild(suffix);
      return { decoration: 'suffix' };
    }, DECORATION_TARGET_SELECTOR);

    if (!result) {
      record.addError('Decorative suffix could not be inserted');
      return;
    }

    record.data = {
      type: 'DecorativeSuffixInsert',
      ...result,
    };
  }

  serialize(): { type: string; params?: any } {
    return { type: 'DecorativeSuffixInsert' };
  }
}
