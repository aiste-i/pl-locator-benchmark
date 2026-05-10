import { Locator, Page } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { isOracleSafeVisible } from './operator-helpers';

export class SplitTextNode implements DomOperator {
  category: 'content' = 'content';

  async isApplicable(page: Page, target: Locator): Promise<boolean> {
    if (!await isOracleSafeVisible(target)) return false;
    return await target.evaluate((node: HTMLElement) =>
      Array.from(node.childNodes).some(child => child.nodeType === Node.TEXT_NODE && (child.textContent?.trim().length ?? 0) > 3),
    );
  }

  async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
    const result = await target.evaluate((node: HTMLElement) => {
      const textNode = Array.from(node.childNodes).find(child =>
        child.nodeType === Node.TEXT_NODE && (child.textContent?.trim().length ?? 0) > 3,
      );
      if (!textNode || !textNode.textContent) {
        return null;
      }

      const midpoint = Math.floor(textNode.textContent.length / 2);
      const left = textNode.textContent.slice(0, midpoint);
      const right = textNode.textContent.slice(midpoint);
      const rightNode = document.createTextNode(right);
      textNode.textContent = left;
      textNode.parentNode?.insertBefore(rightNode, textNode.nextSibling);

      return { splitAt: midpoint };
    });

    if (!result) {
      record.addError('Text node could not be split');
      return;
    }

    record.data = {
      type: 'SplitTextNode',
      ...result,
    };
  }

  serialize(): { type: string; params?: any } {
    return { type: 'SplitTextNode' };
  }
}
