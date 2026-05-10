import type { Locator } from 'playwright';
import { OracleSafety } from '../../utils/OracleSafety';

export const NEUTRAL_WRAPPER_TAGS = ['div', 'span'] as const;

export async function isOracleSafeVisible(locator: Locator): Promise<boolean> {
  if (await OracleSafety.isProtected(locator)) {
    return false;
  }

  try {
    return await locator.evaluate((node: HTMLElement) => {
      const style = window.getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0;
    });
  } catch {
    return false;
  }
}

export async function tagNameOf(locator: Locator): Promise<string | null> {
  try {
    return await locator.evaluate((node: HTMLElement) => node.tagName.toLowerCase());
  } catch {
    return null;
  }
}

export async function hasTag(locator: Locator, tags: string[]): Promise<boolean> {
  const tagName = await tagNameOf(locator);
  return Boolean(tagName && tags.includes(tagName));
}
