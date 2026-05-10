import { Page, Locator } from 'playwright';
import { AccessibilityOperator } from './AccessibilityOperator';
import { MutationRecord } from '../../../MutationRecord';

export class ChangeButtonLabel extends AccessibilityOperator {
    category: 'content' = 'content';
    oracleAnchorSafe = true;
    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (!await super.isApplicable(page, target)) return false;

        return await target.evaluate((el: HTMLElement) => {
            const isButton = el.tagName === 'BUTTON' || el.getAttribute('role') === 'button';
            return isButton && !!el.getAttribute('aria-label');
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const originalLabel = await target.getAttribute('aria-label');
        const newLabel = "Wrong Label Text";
        
        await target.evaluate((el: HTMLElement, val: string) => {
            el.setAttribute('aria-label', val);
        }, newLabel);
        
        record.data = {
            type: 'ChangeButtonLabel',
            originalLabel,
            newLabel
        };
    }
}
