import { Locator, Page } from 'playwright';
import { MutationRecord } from '../../../MutationRecord';
import { OracleSafety } from '../../../utils/OracleSafety';
import { AccessibilityOperator } from './AccessibilityOperator';

export class ToggleAriaExpanded extends AccessibilityOperator {
    category: 'accessibility-semantic' = 'accessibility-semantic';

    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (!await super.isApplicable(page, target)) return false;
        if (await OracleSafety.isProtected(target)) return false;

        return await target.evaluate((el: HTMLElement) => {
            const current = el.getAttribute('aria-expanded');
            return current === 'true' || current === 'false';
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const originalValue = await target.getAttribute('aria-expanded');
        const newValue = originalValue === 'true' ? 'false' : 'true';

        await target.evaluate((el: HTMLElement, value: string) => {
            el.setAttribute('aria-expanded', value);
        }, newValue);

        record.data = {
            type: 'ToggleAriaExpanded',
            originalValue,
            newValue,
        };
    }
}
