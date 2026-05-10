import { Locator, Page } from 'playwright';
import { AccessibilityOperator } from './AccessibilityOperator';
import { MutationRecord } from '../../../MutationRecord';

export class RemovePlaceholderText extends AccessibilityOperator {
    category: 'accessibility-semantic' = 'accessibility-semantic';
    oracleAnchorSafe = true;

    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (!await super.isApplicable(page, target)) return false;

        return await target.evaluate((el: HTMLElement) => {
            if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return false;
            const input = el as HTMLInputElement | HTMLTextAreaElement;
            const disallowedTypes = ['hidden', 'submit', 'reset', 'button', 'image', 'checkbox', 'radio'];
            if ('type' in input && disallowedTypes.includes(input.type)) return false;
            const placeholder = input.getAttribute('placeholder');
            return typeof placeholder === 'string' && placeholder.trim().length > 0;
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const originalPlaceholder = await target.getAttribute('placeholder');

        await target.evaluate((el: HTMLElement) => {
            el.removeAttribute('placeholder');
        });

        record.data = {
            type: 'RemovePlaceholderText',
            originalPlaceholder,
        };
    }
}
