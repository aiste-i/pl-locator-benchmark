import { Locator, Page } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { isOracleSafeVisible } from './operator-helpers';

export class AncestorLift implements DomOperator {
  category: 'structural' = 'structural';

  async isApplicable(page: Page, target: Locator): Promise<boolean> {
    if (!await isOracleSafeVisible(target)) return false;
    return await target.evaluate((node: HTMLElement) => {
      const parent = node.parentElement;
      const grandparent = parent?.parentElement;
      if (!parent || !grandparent) return false;
      if (!['div', 'span'].includes(parent.tagName.toLowerCase())) return false;
      return parent.children.length === 1 && (parent.textContent ?? '').trim() === (node.textContent ?? '').trim();
    });
  }

  async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
    const result = await target.evaluate((node: HTMLElement) => {
      const parent = node.parentElement;
      const grandparent = parent?.parentElement;
      if (!parent || !grandparent) {
        return null;
      }

      grandparent.insertBefore(node, parent);
      if (parent.childElementCount === 0 && (parent.textContent ?? '').trim().length === 0) {
        parent.remove();
      }

      return { parentTag: parent.tagName.toLowerCase() };
    });

    if (!result) {
      record.addError('Ancestor lift could not be applied');
      return;
    }

    record.data = {
      type: 'AncestorLift',
      ...result,
    };
  }

  serialize(): { type: string; params?: any } {
    return { type: 'AncestorLift' };
  }
}
