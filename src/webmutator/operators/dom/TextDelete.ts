import { Page, Locator } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';

export class TextDelete implements DomOperator {
    category: 'content' = 'content';
    oracleAnchorSafe = true;
    
    async isApplicable(page: Page, target: Locator): Promise<boolean> { const text = await target.innerText(); return text.trim().length > 0; }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const deleted = await target.evaluate((node: HTMLElement) => {
            if (node.textContent && node.textContent.trim().length > 0) {
                node.textContent = "";
                return true;
            }
            return false;
        });

        if (deleted) {
            record.data = { action: 'TextDelete' };
        } else {
            record.addError("Node text was empty");
        }
    }

    serialize(): { type: string, params?: any } {
        return { type: 'TextDelete' };
    }
}


