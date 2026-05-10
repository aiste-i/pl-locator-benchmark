import { Locator } from 'playwright';
import { OracleSafety } from './OracleSafety';

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'details',
  'form',
  'input',
  'label',
  'option',
  'select',
  'summary',
  'textarea',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="textbox"]',
].join(', ');

export class MutationTargetSafety {
  static async isInteractiveOrEssential(locator: Locator): Promise<boolean> {
    return locator.evaluate((node: HTMLElement, selector) => node.matches(selector), INTERACTIVE_SELECTOR);
  }

  static async containsInteractiveOrEssentialDescendants(locator: Locator): Promise<boolean> {
    return locator.evaluate((node: HTMLElement, selector) => Boolean(node.querySelector(selector)), INTERACTIVE_SELECTOR);
  }

  static async isSafeStructuralTarget(locator: Locator): Promise<boolean> {
    if (await OracleSafety.isStructuralMutationUnsafe(locator)) {
      return false;
    }

    if (await this.isInteractiveOrEssential(locator)) {
      return false;
    }

    return !(await this.containsInteractiveOrEssentialDescendants(locator));
  }

  static async isSafeVisibilityTarget(locator: Locator): Promise<boolean> {
    if (await OracleSafety.isVisibilityMutationUnsafe(locator)) {
      return false;
    }

    if (await this.isInteractiveOrEssential(locator)) {
      return false;
    }

    return !(await this.containsInteractiveOrEssentialDescendants(locator));
  }
}
