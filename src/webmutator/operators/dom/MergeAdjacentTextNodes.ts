import { Locator, Page } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { isOracleSafeVisible } from './operator-helpers';

export class MergeAdjacentTextNodes implements DomOperator {
  category: 'content' = 'content';

  async isApplicable(page: Page, target: Locator): Promise<boolean> {
    if (!await isOracleSafeVisible(target)) return false;
    return await target.evaluate((node: HTMLElement) => {
      const children = Array.from(node.childNodes);
      return children.some((child, index) =>
        child.nodeType === Node.TEXT_NODE &&
        (child.textContent?.length ?? 0) > 0 &&
        children[index + 1]?.nodeType === Node.TEXT_NODE,
      );
    });
  }

  async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
    const result = await target.evaluate((node: HTMLElement) => {
      const children = Array.from(node.childNodes);
      const firstIndex = children.findIndex((child, index) =>
        child.nodeType === Node.TEXT_NODE &&
        (child.textContent?.length ?? 0) > 0 &&
        children[index + 1]?.nodeType === Node.TEXT_NODE,
      );

      if (firstIndex === -1) {
        return null;
      }

      const first = children[firstIndex];
      const second = children[firstIndex + 1];
      first.textContent = `${first.textContent ?? ''}${second.textContent ?? ''}`;
      second.parentNode?.removeChild(second);
      return { merged: true };
    });

    if (!result) {
      record.addError('Adjacent text nodes could not be merged');
      return;
    }

    record.data = {
      type: 'MergeAdjacentTextNodes',
      ...result,
    };
  }

  serialize(): { type: string; params?: any } {
    return { type: 'MergeAdjacentTextNodes' };
  }
}
