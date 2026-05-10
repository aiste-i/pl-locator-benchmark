import { Locator, Page } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { isOracleSafeVisible } from './operator-helpers';

export class LookalikeSiblingInsertBeforeTarget implements DomOperator {
  category: 'structural' = 'structural';

  async isApplicable(page: Page, target: Locator): Promise<boolean> {
    if (!await isOracleSafeVisible(target)) return false;
    return await target.evaluate((node: HTMLElement) => Boolean(node.parentElement));
  }

  async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
    const result = await target.evaluate((node: HTMLElement) => {
      const parent = node.parentElement;
      if (!parent) {
        return null;
      }

      const clone = node.cloneNode(false) as HTMLElement;
      clone.removeAttribute('id');
      clone.removeAttribute('data-testid');
      clone.setAttribute('aria-hidden', 'true');
      clone.hidden = true;
      if (clone instanceof HTMLButtonElement) {
        clone.disabled = true;
        clone.type = 'button';
      }
      if (clone instanceof HTMLAnchorElement) {
        clone.removeAttribute('href');
      }
      if (!clone.textContent?.trim()) {
        clone.textContent = 'Benchmark decoy';
      }
      parent.insertBefore(clone, node);

      return { insertedTag: clone.tagName.toLowerCase() };
    });

    if (!result) {
      record.addError('Lookalike sibling could not be inserted');
      return;
    }

    record.data = {
      type: 'LookalikeSiblingInsertBeforeTarget',
      ...result,
    };
  }

  serialize(): { type: string; params?: any } {
    return { type: 'LookalikeSiblingInsertBeforeTarget' };
  }
}
