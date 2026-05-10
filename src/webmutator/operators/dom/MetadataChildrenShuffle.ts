import { Locator, Page } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { isOracleSafeVisible } from './operator-helpers';

const METADATA_SELECTOR = '.article-meta, .card-footer, .user-info, .info, .banner';

export class MetadataChildrenShuffle implements DomOperator {
  category: 'structural' = 'structural';

  async isApplicable(page: Page, target: Locator): Promise<boolean> {
    if (!await isOracleSafeVisible(target)) return false;
    return await target.evaluate((node: HTMLElement, selector: string) => {
      const container = node.matches(selector) ? node : node.closest(selector);
      return Boolean(container && container.children.length >= 3);
    }, METADATA_SELECTOR);
  }

  async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
    const result = await target.evaluate((node: HTMLElement, selector: string) => {
      const container = (node.matches(selector) ? node : node.closest(selector)) as HTMLElement | null;
      if (!container || container.children.length < 3) {
        return null;
      }

      const movableChildren = Array.from(container.children).filter(child =>
        !child.matches('button, a[href], input, textarea, select'),
      );
      if (movableChildren.length < 2) {
        return null;
      }

      const first = movableChildren[0];
      container.appendChild(first);
      return { childCount: movableChildren.length };
    }, METADATA_SELECTOR);

    if (!result) {
      record.addError('Metadata children could not be shuffled safely');
      return;
    }

    record.data = {
      type: 'MetadataChildrenShuffle',
      ...result,
    };
  }

  serialize(): { type: string; params?: any } {
    return { type: 'MetadataChildrenShuffle' };
  }
}
