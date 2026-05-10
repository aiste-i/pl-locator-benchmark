import { Page, Locator } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { OracleSafety } from '../../utils/OracleSafety';

export class TextReplace implements DomOperator {
    category: 'content' = 'content';
    text: string;

    constructor(text: string = "MUTATED") {
        this.text = text;
    }

    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (await OracleSafety.isProtected(target)) return false;

        return await target.evaluate((node: HTMLElement) => {
            return node.innerText !== undefined && node.innerText.trim().length > 0;
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        await target.evaluate((node: HTMLElement, text) => {
            node.innerText = text;
        }, this.text);
        
        record.data = { action: 'TextReplace', text: this.text };
    }

    serialize(): { type: string, params?: any } {
        return { type: 'TextReplace', params: { text: this.text } };
    }
}
