import { Locator, Page } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { isOracleSafeVisible } from './operator-helpers';

const CARD_SELECTOR = '.article-preview, .card, article, li';

export class LookalikeCardInsertBeforeTarget implements DomOperator {
  category: 'structural' = 'structural';

  async isApplicable(page: Page, target: Locator): Promise<boolean> {
    if (!await isOracleSafeVisible(target)) return false;
    return await target.evaluate((node: HTMLElement, selector: string) => Boolean(node.closest(selector)?.parentElement), CARD_SELECTOR);
  }

  async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
    const result = await target.evaluate((node: HTMLElement, selector: string) => {
      const card = node.closest(selector) as HTMLElement | null;
      const parent = card?.parentElement;
      if (!card || !parent) {
        return null;
      }

      const clone = card.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('[data-testid]').forEach(element => element.removeAttribute('data-testid'));
      clone.querySelectorAll('button, input, textarea, select').forEach(element => {
        (element as HTMLButtonElement).disabled = true;
      });
      clone.querySelectorAll('a[href]').forEach(element => element.removeAttribute('href'));
      clone.setAttribute('aria-hidden', 'true');
      clone.hidden = true;
      parent.insertBefore(clone, card);

      return { clonedTag: clone.tagName.toLowerCase() };
    }, CARD_SELECTOR);

    if (!result) {
      record.addError('Lookalike card could not be inserted');
      return;
    }

    record.data = {
      type: 'LookalikeCardInsertBeforeTarget',
      ...result,
    };
  }

  serialize(): { type: string; params?: any } {
    return { type: 'LookalikeCardInsertBeforeTarget' };
  }
}
