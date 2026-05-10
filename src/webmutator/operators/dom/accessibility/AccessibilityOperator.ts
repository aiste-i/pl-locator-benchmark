import { Page, Locator } from 'playwright';
import { DomOperator } from '../DomOperator';
import { MutationRecord } from '../../../MutationRecord';

export abstract class AccessibilityOperator implements DomOperator {
    abstract category: 'structural' | 'content' | 'accessibility-semantic' | 'visibility';
    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        try {
            return await target.evaluate((el: HTMLElement) => {
                const style = window.getComputedStyle(el);
                const isVisible = style.display !== 'none' && 
                                 style.visibility !== 'hidden' && 
                                 parseFloat(style.opacity || '1') > 0;
                const isAccessible = el.getAttribute('aria-hidden') !== 'true' && 
                                    el.getAttribute('role') !== 'presentation' && 
                                    el.getAttribute('role') !== 'none';
                return isVisible && isAccessible;
            });
        } catch (e) {
            return false;
        }
    }

    abstract applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void>;

    serialize(): { type: string, params?: any } {
        return { type: this.constructor.name };
    }
}
