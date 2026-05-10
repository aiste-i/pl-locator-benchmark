import { Locator, Page } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { isOracleSafeVisible } from './operator-helpers';

export class AncestorSink implements DomOperator {
  category: 'structural' = 'structural';

  async isApplicable(page: Page, target: Locator): Promise<boolean> {
    if (!await isOracleSafeVisible(target)) return false;
    return await target.evaluate((node: HTMLElement) => Boolean(node.parentElement && node.tagName.toLowerCase() !== 'body'));
  }

  async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
    const result = await target.evaluate((node: HTMLElement) => {
      const parent = node.parentElement;
      if (!parent) {
        return null;
      }

      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-benchmark-wrapper', 'ancestor-sink');
      wrapper.style.display = 'block';
      parent.insertBefore(wrapper, node);
      wrapper.appendChild(node);
      return { wrapperTag: wrapper.tagName.toLowerCase() };
    });

    if (!result) {
      record.addError('Ancestor sink could not be applied');
      return;
    }

    record.data = {
      type: 'AncestorSink',
      ...result,
    };
  }

  serialize(): { type: string; params?: any } {
    return { type: 'AncestorSink' };
  }
}
