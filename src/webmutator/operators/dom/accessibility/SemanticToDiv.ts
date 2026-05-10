import { Page, Locator } from 'playwright';
import { AccessibilityOperator } from './AccessibilityOperator';
import { MutationRecord } from '../../../MutationRecord';

export class SemanticToDiv extends AccessibilityOperator {
    category: 'structural' = 'structural';
    oracleAnchorSafe = true;
    private semanticTags = ['HEADER', 'FOOTER', 'NAV', 'MAIN', 'SECTION', 'ARTICLE', 'ASIDE'];

    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (!await super.isApplicable(page, target)) return false;

        return await target.evaluate((el: HTMLElement, tags: string[]) => {
            return tags.includes(el.tagName);
        }, this.semanticTags);
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const fromTag = await target.evaluate(el => el.tagName.toLowerCase());
        
        await target.evaluate((el: HTMLElement) => {
            const div = document.createElement('div');
            
            // Copy all attributes
            for (let i = 0; i < el.attributes.length; i++) {
                div.setAttribute(el.attributes[i].name, el.attributes[i].value);
            }
            
            // Move all children
            while (el.firstChild) {
                div.appendChild(el.firstChild);
            }
            
            // Preserve basic layout styling just in case (though these are mostly block elements)
            const style = window.getComputedStyle(el);
            div.style.display = style.display;
            
            if (el.parentNode) {
                el.parentNode.replaceChild(div, el);
            }
        });
        
        record.data = {
            type: 'SemanticToDiv',
            from: fromTag,
            to: 'div'
        };
    }
}
