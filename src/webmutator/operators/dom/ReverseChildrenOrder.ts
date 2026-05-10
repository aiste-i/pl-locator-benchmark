import { Page, Locator } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { MutationTargetSafety } from '../../utils/MutationTargetSafety';

export class ReverseChildrenOrder implements DomOperator {
    category: 'structural' = 'structural';

    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (!(await MutationTargetSafety.isSafeStructuralTarget(target))) return false;
        return await target.evaluate((node: HTMLElement) => {
            const interactiveSelector = 'a[href], button, input, select, textarea, form, [role="button"], [role="link"], [role="textbox"]';
            const safeChildren = Array.from(node.children).filter(child =>
                !child.hasAttribute('data-testid') &&
                !child.querySelector('[data-testid]') &&
                !child.matches(interactiveSelector) &&
                !child.querySelector(interactiveSelector),
            );
            return safeChildren.length >= 2;
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const reversed = await target.evaluate((node: HTMLElement) => {
            const interactiveSelector = 'a[href], button, input, select, textarea, form, [role="button"], [role="link"], [role="textbox"]';
            const children = Array.from(node.children).filter(child =>
                !child.hasAttribute('data-testid') &&
                !child.querySelector('[data-testid]') &&
                !child.matches(interactiveSelector) &&
                !child.querySelector(interactiveSelector),
            );
            if (children.length < 2) {
                return false;
            }

            for (const child of children.reverse()) {
                node.appendChild(child);
            }

            return true;
        });

        if (reversed) {
            record.data = { action: 'ReverseChildrenOrder' };
        } else {
            record.addError('Not enough children to reorder');
        }
    }

    serialize(): { type: string; params?: any } {
        return { type: 'ReverseChildrenOrder' };
    }
}
