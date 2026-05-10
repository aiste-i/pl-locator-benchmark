import { Page, Locator } from 'playwright';
import { AccessibilityOperator } from './AccessibilityOperator';
import { MutationRecord } from '../../../MutationRecord';

export class ChangeAriaLabel extends AccessibilityOperator {
    category: 'accessibility-semantic' = 'accessibility-semantic';
    oracleAnchorSafe = true;

    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (!await super.isApplicable(page, target)) return false;

        return await target.evaluate((el: HTMLElement) => {
            return typeof el.getAttribute('aria-label') === 'string' && el.getAttribute('aria-label') !== '';
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const originalLabel = await target.getAttribute('aria-label');
        const newLabel = 'Benchmark aria label mutation';

        await target.evaluate((el: HTMLElement, value: string) => {
            el.setAttribute('aria-label', value);
        }, newLabel);

        record.data = {
            type: 'ChangeAriaLabel',
            originalLabel,
            newLabel
        };
    }
}
