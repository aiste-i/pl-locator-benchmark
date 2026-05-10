import { Page, Locator } from 'playwright';
import { AccessibilityOperator } from './AccessibilityOperator';
import { MutationRecord } from '../../../MutationRecord';

export class ChangeImageAlt extends AccessibilityOperator {
    category: 'content' = 'content';
    oracleAnchorSafe = true;
    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (!await super.isApplicable(page, target)) return false;

        return await target.evaluate((el: HTMLElement) => {
            if (el.tagName !== 'IMG') return false;
            const alt = el.getAttribute('alt');
            if (alt === null || alt.trim() === '') return false;

            const trivialNames = ['spacer', 'image', 'picture', 'img', 'photo', 'graphic'];
            const lowerAlt = alt.toLowerCase().trim();
            if (trivialNames.includes(lowerAlt)) return false;

            const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
            if (extensions.some(ext => lowerAlt.endsWith(ext))) return false;

            const src = el.getAttribute('src');
            if (src && alt === src) return false;

            // Duplicate alt texts on same page
            const allAlts = Array.from(document.querySelectorAll('img[alt]'))
                .map(img => img.getAttribute('alt')?.toLowerCase().trim());
            const count = allAlts.filter(a => a === lowerAlt).length;
            if (count > 1) return false;

            return true;
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const originalAlt = await target.getAttribute('alt');
        const newAlt = "Unrelated Alternative Text Description";
        
        await target.evaluate((el: HTMLElement, val: string) => {
            el.setAttribute('alt', val);
        }, newAlt);
        
        record.data = {
            type: 'ChangeImageAlt',
            originalAlt,
            newAlt
        };
    }
}
