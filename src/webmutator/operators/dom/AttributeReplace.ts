import { Page, Locator } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';

export class AttributeReplace implements DomOperator {
    category: 'structural' = 'structural';
    
    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        return await target.evaluate((node: HTMLElement) => {
            const attrs = node.getAttributeNames().filter(a => a.toLowerCase() !== 'data-testid');
            return attrs.length > 0;
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const attributeToReplace = await target.evaluate((node: HTMLElement) => {
            const attrs = node.getAttributeNames().filter(a => a.toLowerCase() !== 'data-testid');
            if (attrs.length > 0) {
                return attrs[0];
            }
            return null;
        });

        if (attributeToReplace) {
            const newValue = "mutated_value";
            await target.evaluate((node: HTMLElement, {attr, val}) => {
                node.setAttribute(attr, val);
            }, {attr: attributeToReplace, val: newValue});
            record.data = { action: 'AttributeReplace', attribute: attributeToReplace, value: newValue };
        } else {
            record.addError("No eligible attributes to replace");
        }
    }

    serialize(): { type: string, params?: any } {
        return { type: 'AttributeReplace' };
    }
}
