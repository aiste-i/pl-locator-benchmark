import { Page, Locator } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { MutationTargetSafety } from '../../utils/MutationTargetSafety';

export class SubtreeDelete implements DomOperator {
    category: 'structural' = 'structural';
    
    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (!(await MutationTargetSafety.isSafeStructuralTarget(target))) return false;
        return await target.evaluate((node: HTMLElement) => node.children.length > 0);
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const deleted = await target.evaluate((node: HTMLElement) => {
            let hasChildren = false;
            // Remove all element children
            const children = Array.from(node.children);
            if (children.length > 0) {
                hasChildren = true;
                children.forEach(child => node.removeChild(child));
                node.setAttribute('mutated', 'true');
            }
            return hasChildren;
        });

        if (deleted) {
            record.data = { action: 'SubtreeDelete' };
        } else {
            record.addError("No children to delete");
        }
    }

    serialize(): { type: string, params?: any } {
        return { type: 'SubtreeDelete' };
    }
}
