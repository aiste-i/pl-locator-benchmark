import { Page, Locator } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';

export class AttributeAdd implements DomOperator {
    category: 'structural' = 'structural';
    private attributeName: string;
    private attributeValue: string;

    constructor(name: string = "data-mutated", value: string = "true") {
        this.attributeName = name;
        this.attributeValue = value;
    }

    async isApplicable(page: Page, target: Locator): Promise<boolean> { return true; }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        await target.evaluate((node: HTMLElement, args) => {
            node.setAttribute(args.name, args.value);
        }, { name: this.attributeName, value: this.attributeValue });
        
        record.data = { action: 'AttributeAdd', name: this.attributeName, value: this.attributeValue };
    }

    serialize(): { type: string, params?: any } {
        return { type: 'AttributeAdd', params: { name: this.attributeName, value: this.attributeValue } };
    }
}

