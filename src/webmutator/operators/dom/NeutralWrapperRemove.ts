import { Locator, Page } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { isOracleSafeVisible } from './operator-helpers';

export class NeutralWrapperRemove implements DomOperator {
  category: 'structural' = 'structural';

  async isApplicable(page: Page, target: Locator): Promise<boolean> {
    if (!await isOracleSafeVisible(target)) return false;
    return await target.evaluate((node: HTMLElement) => {
      const tag = node.tagName.toLowerCase();
      if (!['div', 'span'].includes(tag)) return false;
      if (node.id || node.getAttribute('role') || node.getAttribute('aria-label') || node.getAttribute('data-testid')) return false;
      if ((node.textContent ?? '').trim().length > 0 && node.children.length === 0) return false;
      return node.children.length === 1 && Array.from(node.childNodes).every(child =>
        child.nodeType === Node.ELEMENT_NODE || (child.textContent?.trim().length ?? 0) === 0,
      );
    });
  }

  async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
    const result = await target.evaluate((node: HTMLElement) => {
      const parent = node.parentElement;
      const child = node.firstElementChild;
      if (!parent || !child) {
        return null;
      }

      parent.insertBefore(child, node);
      node.remove();
      return { removedTag: node.tagName.toLowerCase() };
    });

    if (!result) {
      record.addError('Neutral wrapper could not be removed safely');
      return;
    }

    record.data = {
      type: 'NeutralWrapperRemove',
      ...result,
    };
  }

  serialize(): { type: string; params?: any } {
    return { type: 'NeutralWrapperRemove' };
  }
}
