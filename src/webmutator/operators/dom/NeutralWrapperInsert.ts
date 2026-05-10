import { Locator, Page } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { isOracleSafeVisible } from './operator-helpers';

export class NeutralWrapperInsert implements DomOperator {
  category: 'structural' = 'structural';

  async isApplicable(page: Page, target: Locator): Promise<boolean> {
    if (!await isOracleSafeVisible(target)) return false;
    return await target.evaluate((node: HTMLElement) => Boolean(node.parentElement && node.parentElement !== document.body));
  }

  async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
    const result = await target.evaluate((node: HTMLElement) => {
      const parent = node.parentElement;
      if (!parent) {
        return null;
      }

      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-benchmark-wrapper', 'neutral-insert');
      wrapper.style.display = 'contents';
      parent.insertBefore(wrapper, node);
      wrapper.appendChild(node);

      return { wrapperTag: wrapper.tagName.toLowerCase() };
    });

    if (!result) {
      record.addError('No parent available for neutral wrapper insertion');
      return;
    }

    record.data = {
      type: 'NeutralWrapperInsert',
      ...result,
    };
  }

  serialize(): { type: string; params?: any } {
    return { type: 'NeutralWrapperInsert' };
  }
}
