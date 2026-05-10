import { Page, Locator } from 'playwright';
import { AccessibilityOperator } from './AccessibilityOperator';
import { MutationRecord } from '../../../MutationRecord';

export class RemoveInputNames extends AccessibilityOperator {
    category: 'accessibility-semantic' = 'accessibility-semantic';
    oracleAnchorSafe = true;
    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (!await super.isApplicable(page, target)) return false;

        return await target.evaluate((el: HTMLElement) => {
            if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') return false;
            
            // Check for accessible name sources
            if (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) return true;
            
            // Check for label association
            const id = el.id;
            if (id && document.querySelector(`label[for="${id}"]`)) return true;
            
            // Check for parent label
            if (el.closest('label')) return true;

            // Check placeholder/title fallback surfaces
            const placeholder = el.getAttribute('placeholder');
            if (placeholder && placeholder.trim() !== '') return true;

            const title = el.getAttribute('title');
            if (title && title.trim() !== '') return true;

            return false;
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        await target.evaluate((el: HTMLElement) => {
            // Remove ARIA labels
            el.removeAttribute('aria-label');
            el.removeAttribute('aria-labelledby');
            el.removeAttribute('placeholder');
            el.removeAttribute('title');
            
            // Break <label for="..."> association
            const id = el.id;
            if (id) {
                const labels = document.querySelectorAll(`label[for="${id}"]`);
                labels.forEach(label => {
                    label.removeAttribute('for');
                });
            }
            
            // If it's inside a label, we might want to move it out to break implicit association,
            // but that's risky for layout. For now, removing aria-label and for-association covers many cases.
        });
        
        record.data = {
            type: 'RemoveInputNames'
        };
    }
}
