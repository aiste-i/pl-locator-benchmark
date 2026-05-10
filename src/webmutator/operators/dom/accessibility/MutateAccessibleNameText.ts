import { Locator, Page } from 'playwright';
import { AccessibilityOperator } from './AccessibilityOperator';
import { MutationRecord } from '../../../MutationRecord';

const ACCESSIBLE_NAME_SURFACE_SELECTOR = [
  'button',
  '[role="button"]',
  'a[href]',
  '[role="link"]',
  'label',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
].join(', ');

export class MutateAccessibleNameText extends AccessibilityOperator {
  category: 'accessibility-semantic' = 'accessibility-semantic';
  oracleAnchorSafe = true;

  async isApplicable(page: Page, target: Locator): Promise<boolean> {
    if (!await super.isApplicable(page, target)) return false;

    return await target.evaluate((el: HTMLElement, surfaceSelector: string) => {
      const surface = el.matches(surfaceSelector)
        ? el
        : el.closest(surfaceSelector);

      if (!surface) return false;
      if (surface === el && el.hasAttribute('data-testid')) return false;
      if (surface.getAttribute('aria-hidden') === 'true') return false;
      if (surface.getAttribute('role') === 'presentation' || surface.getAttribute('role') === 'none') return false;

      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return node.textContent && node.textContent.trim().length > 0
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        },
      });

      const textNode = walker.nextNode();
      if (!textNode) return false;

      const textValue = textNode.textContent?.trim() ?? '';
      if (textValue.length < 2) return false;

      const lower = textValue.toLowerCase();
      if (/^\d+$/.test(lower)) return false;
      if (['-', '|', '/', '>', '<'].includes(lower)) return false;

      return true;
    }, ACCESSIBLE_NAME_SURFACE_SELECTOR);
  }

  async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
    const result = await target.evaluate((el: HTMLElement, surfaceSelector: string) => {
      const surface = el.matches(surfaceSelector)
        ? el
        : el.closest(surfaceSelector);

      if (!surface) {
        return null;
      }

      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return node.textContent && node.textContent.trim().length > 0
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        },
      });

      const textNode = walker.nextNode();
      if (!textNode) {
        return null;
      }

      const originalText = textNode.textContent ?? '';
      const newText = 'Benchmark accessible name mutation';
      textNode.textContent = newText;

      return {
        surfaceTag: surface.tagName.toLowerCase(),
        originalText,
        newText,
      };
    }, ACCESSIBLE_NAME_SURFACE_SELECTOR);

    if (!result) {
      record.addError('Could not find mutable accessible-name text surface');
      return;
    }

    record.data = {
      type: 'MutateAccessibleNameText',
      ...result,
    };
  }
}
