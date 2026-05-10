import { Page, Locator } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { MutationTargetSafety } from '../../utils/MutationTargetSafety';

export class SubtreeSwap implements DomOperator {
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
        const swapped = await target.evaluate((node: HTMLElement) => {
            const interactiveSelector = 'a[href], button, input, select, textarea, form, [role="button"], [role="link"], [role="textbox"]';
            const children = Array.from(node.children).filter(child =>
                !child.hasAttribute('data-testid') &&
                !child.querySelector('[data-testid]') &&
                !child.matches(interactiveSelector) &&
                !child.querySelector(interactiveSelector),
            );
            if (children.length >= 2) {
                const idx1 = Math.floor(Math.random() * children.length);
                let idx2 = Math.floor(Math.random() * children.length);
                while (idx1 === idx2) idx2 = Math.floor(Math.random() * children.length);

                const node1 = children[idx1];
                const node2 = children[idx2];

                const dummy = document.createElement('div');
                node.insertBefore(dummy, node1);
                node.insertBefore(node1, node2);
                node.insertBefore(node2, dummy);
                node.removeChild(dummy);
                return true;
            }
            return false;
        });

        if (swapped) {
            record.data = { action: 'SubtreeSwap' };
        } else {
            record.addError("Not enough children to swap");
        }
    }

    serialize(): { type: string, params?: any } {
        return { type: 'SubtreeSwap' };
    }
}
