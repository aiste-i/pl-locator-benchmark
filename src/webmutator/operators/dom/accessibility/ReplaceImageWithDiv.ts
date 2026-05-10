import { Page, Locator } from 'playwright';
import { AccessibilityOperator } from './AccessibilityOperator';
import { MutationRecord } from '../../../MutationRecord';

export class ReplaceImageWithDiv extends AccessibilityOperator {
    category: 'structural' = 'structural';
    oracleAnchorSafe = true;
    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (!await super.isApplicable(page, target)) return false;

        return await target.evaluate((el: HTMLElement) => {
            return el.tagName === 'IMG';
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        await target.evaluate((el: HTMLImageElement) => {
            const style = window.getComputedStyle(el);
            const div = document.createElement('div');
            
            // Copy relevant styles to preserve layout
            div.style.width = style.width;
            div.style.height = style.height;
            div.style.display = style.display === 'inline' ? 'inline-block' : style.display;
            div.style.position = style.position;
            div.style.top = style.top;
            div.style.left = style.left;
            div.style.margin = style.margin;
            div.style.padding = style.padding;
            div.style.border = style.border;
            div.style.borderRadius = style.borderRadius;
            div.style.boxSizing = style.boxSizing;
            
            // Set background image
            div.style.backgroundImage = `url("${el.src}")`;
            div.style.backgroundRepeat = 'no-repeat';
            
            // Handle object-fit
            const objectFit = style.objectFit;
            if (objectFit === 'cover' || objectFit === 'contain') {
                div.style.backgroundSize = objectFit;
            } else {
                div.style.backgroundSize = '100% 100%';
            }
            
            div.style.backgroundPosition = style.objectPosition || 'center';
            
            for (let i = 0; i < el.attributes.length; i++) {
                const attr = el.attributes[i];
                if (attr.name === 'src' || attr.name === 'alt') {
                    continue;
                }
                div.setAttribute(attr.name, attr.value);
            }
            
            // Replace the image with the div
            if (el.parentNode) {
                el.parentNode.replaceChild(div, el);
            }
        });
        
        record.data = {
            type: 'ReplaceImageWithDiv'
        };
    }
}
