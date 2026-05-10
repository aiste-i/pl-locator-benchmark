import { Page, Locator } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';

export class StyleColor implements DomOperator {
    category: 'visibility' = 'visibility';
    oracleAnchorSafe = true;
    private color: string;

    constructor(color: string = "red") {
        this.color = color;
    }

    async isApplicable(page: Page, target: Locator): Promise<boolean> { return true; }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const oldColor = await target.evaluate((node: HTMLElement) => node.style.color);
        await target.evaluate((node: HTMLElement, color) => {
            node.style.color = color;
        }, this.color);
        
        record.data = { action: 'StyleColor', oldColor: oldColor, newColor: this.color };
    }

    serialize(): { type: string, params?: any } {
        return { type: 'StyleColor', params: { color: this.color } };
    }
}

