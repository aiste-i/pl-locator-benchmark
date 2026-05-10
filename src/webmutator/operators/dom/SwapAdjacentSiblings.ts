import { Locator, Page } from 'playwright';
import { MutationRecord } from '../../MutationRecord';
import { MutationTargetSafety } from '../../utils/MutationTargetSafety';
import { DomOperator } from './DomOperator';

export class SwapAdjacentSiblings implements DomOperator {
    category: 'structural' = 'structural';

    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (!(await MutationTargetSafety.isSafeStructuralTarget(target))) return false;

        return await target.evaluate((node: HTMLElement) => {
            const sibling = node.nextElementSibling as HTMLElement | null;
            if (!node.parentElement || !sibling) {
                return false;
            }

            const interactiveSelector = 'a[href], button, input, select, textarea, form, [role="button"], [role="link"], [role="textbox"]';
            const isProtected = (element: HTMLElement) =>
                element.hasAttribute('data-testid') ||
                Boolean(element.querySelector('[data-testid]')) ||
                element.matches(interactiveSelector) ||
                Boolean(element.querySelector(interactiveSelector));

            return !isProtected(node) && !isProtected(sibling);
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const swapped = await target.evaluate((node: HTMLElement) => {
            const parent = node.parentElement;
            const sibling = node.nextElementSibling as HTMLElement | null;
            if (!parent || !sibling) {
                return false;
            }

            parent.insertBefore(sibling, node);
            return {
                swappedWithTag: sibling.tagName.toLowerCase(),
                swappedWithClass: sibling.className || null,
            };
        });

        if (swapped) {
            record.data = { action: 'SwapAdjacentSiblings', ...swapped };
        } else {
            record.addError('Target has no adjacent sibling to swap with');
        }
    }

    serialize(): { type: string; params?: any } {
        return { type: 'SwapAdjacentSiblings' };
    }
}
