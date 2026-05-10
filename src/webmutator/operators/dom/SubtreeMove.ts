import { Page, Locator } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { MutationTargetSafety } from '../../utils/MutationTargetSafety';

export class SubtreeMove implements DomOperator {
    category: 'structural' = 'structural';
    
    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (!(await MutationTargetSafety.isSafeStructuralTarget(target))) return false;

        return await target.evaluate((node: HTMLElement) => {
            if (!node.parentElement) {
                return false;
            }

            const interactiveSelector = 'a[href], button, input, select, textarea, form, [role="button"], [role="link"], [role="textbox"]';
            return Array.from(node.parentElement.children).some(sibling =>
                sibling !== node &&
                !sibling.hasAttribute('data-testid') &&
                !sibling.querySelector('[data-testid]') &&
                !sibling.matches(interactiveSelector) &&
                !sibling.querySelector(interactiveSelector),
            );
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const moved = await target.evaluate((node: HTMLElement) => {
            if (!node.parentElement) {
                return false;
            }

            const interactiveSelector = 'a[href], button, input, select, textarea, form, [role="button"], [role="link"], [role="textbox"]';
            const available = Array.from(node.parentElement.children).filter(sibling =>
                sibling !== node &&
                !sibling.hasAttribute('data-testid') &&
                !sibling.querySelector('[data-testid]') &&
                !sibling.matches(interactiveSelector) &&
                !sibling.querySelector(interactiveSelector),
            );

            if (available.length > 0) {
                const targetContainer = available[Math.floor(Math.random() * available.length)];
                targetContainer.appendChild(node);
                targetContainer.setAttribute('mutated', 'true');
                return true;
            }
            return false;
        });

        if (moved) {
            record.data = { action: 'SubtreeMove' };
        } else {
            record.addError("No target container found for move");
        }
    }

    serialize(): { type: string, params?: any } {
        return { type: 'SubtreeMove' };
    }
}
