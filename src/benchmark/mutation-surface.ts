import type { Page } from '@playwright/test';
import type { MutationSurfaceSnapshot } from './mutation-quality';
import { getImmediateElementHandle } from '../utils/locator-handles';

export async function captureMutationSurface(page: Page, selector: string): Promise<MutationSurfaceSnapshot | null> {
  const locator = page.locator(selector).first();
  const handle = await getImmediateElementHandle(locator);
  if (!handle) {
    return {
      exists: false,
      tagType: null,
      textContent: null,
      className: null,
      style: null,
      role: null,
      ariaLabel: null,
      ariaLabelledBy: null,
      placeholder: null,
      alt: null,
      title: null,
      id: null,
      htmlFor: null,
      hidden: null,
      childElementCount: null,
      textNodeCount: null,
      parentSelector: null,
    };
  }

  try {
    return await handle.evaluate((node: Element) => {
      const computeSelector = (element: Element | null): string | null => {
        if (!element) {
          return null;
        }

        const path: string[] = [];
        let current: Element | null = element;
        while (current && current !== document.body) {
          let entry = current.tagName.toLowerCase();
          if (current.parentElement) {
            const siblings = Array.from(current.parentElement.children).filter(child => child.tagName === current?.tagName);
            if (siblings.length > 1) {
              entry += `:nth-of-type(${siblings.indexOf(current) + 1})`;
            }
          }
          path.unshift(entry);
          current = current.parentElement;
        }
        return path.join(' > ');
      };

      const element = node as HTMLElement;
      const textNodeCount = Array.from(element.childNodes).filter(child => child.nodeType === Node.TEXT_NODE && (child.textContent?.trim().length ?? 0) > 0).length;
      return {
        exists: true,
        tagType: element.tagName.toLowerCase(),
        textContent: element.textContent?.trim() ?? null,
        className: element.getAttribute('class'),
        style: element.getAttribute('style'),
        role: element.getAttribute('role'),
        ariaLabel: element.getAttribute('aria-label'),
        ariaLabelledBy: element.getAttribute('aria-labelledby'),
        placeholder: element.getAttribute('placeholder'),
        alt: element.getAttribute('alt'),
        title: element.getAttribute('title'),
        id: element.getAttribute('id'),
        htmlFor: element.tagName.toLowerCase() === 'label' ? element.getAttribute('for') : null,
        hidden: element.hidden,
        childElementCount: element.childElementCount,
        textNodeCount,
        parentSelector: computeSelector(element.parentElement),
      };
    });
  } finally {
    await handle.dispose().catch(() => undefined);
  }
}
