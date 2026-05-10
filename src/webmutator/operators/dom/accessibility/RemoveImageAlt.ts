import { Page, Locator } from 'playwright';
import { AccessibilityOperator } from './AccessibilityOperator';
import { MutationRecord } from '../../../MutationRecord';

export class RemoveImageAlt extends AccessibilityOperator {
    category: 'content' = 'content';
    oracleAnchorSafe = true;
    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (!await super.isApplicable(page, target)) return false;

        return await target.evaluate((el: HTMLElement) => {
            return el.tagName === 'IMG' && el.hasAttribute('alt');
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const originalAlt = await target.getAttribute('alt');
        
        await target.evaluate((el: HTMLElement) => {
            el.removeAttribute('alt');
        });
        
        record.data = {
            type: 'RemoveImageAlt',
            originalAlt
        };
    }
}
