import { Page, Locator } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { RandomUtils } from '../../utils/RandomUtils';

export class TextInsert implements DomOperator {
    category: 'content' = 'content';
    
    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        const text = await target.textContent();
        return !text || text.trim().length === 0;
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const textToInsert = RandomUtils.getRandomString(10);

        const inserted = await target.evaluate((node: HTMLElement, text) => {
            if (!node.textContent || node.textContent.trim().length === 0) {
                node.textContent = text;
                return true;
            }
            return false;
        }, textToInsert);

        if (inserted) {
            record.data = { action: 'TextInsert', value: textToInsert };
        } else {
            record.addError("Node was not empty");
        }
    }

    serialize(): { type: string, params?: any } {
        return { type: 'TextInsert' };
    }
}


