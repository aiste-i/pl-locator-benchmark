import { Page, Locator } from 'playwright';
import { AccessibilityOperator } from './AccessibilityOperator';
import { MutationRecord } from '../../../MutationRecord';

export class DuplicateId extends AccessibilityOperator {
    category: 'accessibility-semantic' = 'accessibility-semantic';
    oracleAnchorSafe = true;
    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (!await super.isApplicable(page, target)) return false;

        return await target.evaluate((el: HTMLElement) => {
            return !!el.id;
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const idToDuplicate = await target.getAttribute('id');
        
        const success = await target.evaluate((el: HTMLElement, id: string) => {
            // Find another element that doesn't have an ID and is not critical
            const candidates = Array.from(document.querySelectorAll('div, span, p, li'));
            const targetOther = candidates.find(c => c !== el && !c.id);
            
            if (targetOther) {
                targetOther.id = id;
                return true;
            }
            return false;
        }, idToDuplicate!);
        
        if (success) {
            record.data = {
                type: 'DuplicateId',
                id: idToDuplicate
            };
        } else {
            record.addError("Could not find a suitable element to duplicate ID");
        }
    }
}
