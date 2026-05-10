import { Page, Locator } from 'playwright';
import { AccessibilityOperator } from './AccessibilityOperator';
import { MutationRecord } from '../../../MutationRecord';

export class ReplaceAnchorWithSpan extends AccessibilityOperator {
    category: 'structural' = 'structural';
    oracleAnchorSafe = true;
    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (!await super.isApplicable(page, target)) return false;

        return await target.evaluate((el: HTMLElement) => {
            // Only apply if it's an <a> and doesn't already have its role hidden
            return el.tagName === 'A' && el.getAttribute('role') !== 'presentation' && el.getAttribute('role') !== 'none';
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        await target.evaluate((el: HTMLElement) => {
            // Keep the <a> but set role="presentation" or role="none" 
            // so getByRole('link') fails while click behavior remains.
            el.setAttribute('role', 'presentation');
            // Some screen readers might still see it as a link if it has href.
            // aria-hidden="true" would hide it entirely, but that's not what we want.
            // To be sure getByRole('link') fails, role="presentation" is standard.
        });
        
        record.data = {
            type: 'ReplaceAnchorWithSpan'
        };
    }
}
