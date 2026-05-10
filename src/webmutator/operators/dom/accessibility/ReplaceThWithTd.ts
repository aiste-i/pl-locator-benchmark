import { Page, Locator } from 'playwright';
import { AccessibilityOperator } from './AccessibilityOperator';
import { MutationRecord } from '../../../MutationRecord';

export class ReplaceThWithTd extends AccessibilityOperator {
    category: 'structural' = 'structural';
    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (!await super.isApplicable(page, target)) return false;

        return await target.evaluate((el: HTMLElement) => {
            return el.tagName === 'TH';
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        await target.evaluate((el: HTMLElement) => {
            const td = document.createElement('td');
            const style = window.getComputedStyle(el);
            
            // Preserve basic styling
            td.style.fontWeight = style.fontWeight;
            td.style.textAlign = style.textAlign;
            
            td.innerHTML = el.innerHTML;
            
            // Copy attributes
            if (el.id) td.id = el.id;
            if (el.className) td.className = el.className;
            
            if (el.parentNode) {
                el.parentNode.replaceChild(td, el);
            }
        });
        
        record.data = {
            type: 'ReplaceThWithTd'
        };
    }
}
