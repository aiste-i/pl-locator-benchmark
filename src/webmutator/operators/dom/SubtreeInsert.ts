import { Page, Locator } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { MutationTargetSafety } from '../../utils/MutationTargetSafety';

export class SubtreeInsert implements DomOperator {
    category: 'structural' = 'structural';
    
    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (!(await MutationTargetSafety.isSafeStructuralTarget(target))) return false;
        return await target.evaluate((node: HTMLElement) => !!node.parentElement);
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const inserted = await target.evaluate((node: HTMLElement) => {
            const parent = node.parentElement;
            if (parent) {
                const clone = node.cloneNode(true) as HTMLElement;
                parent.appendChild(clone);
                parent.setAttribute('mutated', 'true');
                return true;
            }
            return false;
        });

        if (inserted) {
            record.data = { action: 'SubtreeInsert' };
        } else {
            record.addError("No parent found to insert clone");
        }
    }

    serialize(): { type: string, params?: any } {
        return { type: 'SubtreeInsert' };
    }
}

