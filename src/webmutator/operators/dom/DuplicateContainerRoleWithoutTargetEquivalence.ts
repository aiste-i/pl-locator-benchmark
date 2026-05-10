import { Locator, Page } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { isOracleSafeVisible } from './operator-helpers';

const CONTAINER_SELECTOR = '[role], .article-preview, .user-info, .pagination li, .card';

export class DuplicateContainerRoleWithoutTargetEquivalence implements DomOperator {
  category: 'accessibility-semantic' = 'accessibility-semantic';

  async isApplicable(page: Page, target: Locator): Promise<boolean> {
    if (!await isOracleSafeVisible(target)) return false;
    return await target.evaluate((node: HTMLElement, selector: string) => Boolean(node.closest(selector)?.parentElement), CONTAINER_SELECTOR);
  }

  async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
    const result = await target.evaluate((node: HTMLElement, selector: string) => {
      const container = node.closest(selector) as HTMLElement | null;
      const parent = container?.parentElement;
      if (!container || !parent) {
        return null;
      }

      const clone = container.cloneNode(false) as HTMLElement;
      clone.removeAttribute('id');
      clone.removeAttribute('data-testid');
      clone.setAttribute('aria-label', `${container.getAttribute('aria-label') || 'Benchmark duplicate container'}`);
      if (!clone.getAttribute('role') && container.classList.contains('article-preview')) {
        clone.setAttribute('role', 'article');
      }
      clone.textContent = 'Benchmark duplicate container';
      parent.insertBefore(clone, container);

      return {
        duplicateTag: clone.tagName.toLowerCase(),
        duplicateRole: clone.getAttribute('role'),
      };
    }, CONTAINER_SELECTOR);

    if (!result) {
      record.addError('Duplicate container could not be inserted');
      return;
    }

    record.data = {
      type: 'DuplicateContainerRoleWithoutTargetEquivalence',
      ...result,
    };
  }

  serialize(): { type: string; params?: any } {
    return { type: 'DuplicateContainerRoleWithoutTargetEquivalence' };
  }
}
