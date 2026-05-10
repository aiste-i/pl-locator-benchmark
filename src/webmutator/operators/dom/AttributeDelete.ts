import { Page, Locator } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';

export class AttributeDelete implements DomOperator {
    category: 'structural' = 'structural';
    
    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        return await target.evaluate((node: HTMLElement) => {
            const attrs = node.getAttributeNames().filter(a => a.toLowerCase() !== 'data-testid');
            return attrs.length > 0;
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const attributeToRemove = await target.evaluate((node: HTMLElement) => {
            const attrs = node.getAttributeNames().filter(a => a.toLowerCase() !== 'data-testid');
            if (attrs.length > 0) {
                return attrs[0];
            }
            return null;
        });

        if (attributeToRemove) {
            await target.evaluate((node: HTMLElement, attr) => {
                node.removeAttribute(attr);
            }, attributeToRemove);
            record.data = { action: 'AttributeDelete', attribute: attributeToRemove };
        } else {
            record.addError("No eligible attributes to delete");
        }
    }

    serialize(): { type: string, params?: any } {
        return { type: 'AttributeDelete' };
    }
}
