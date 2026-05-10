import { Page, Locator } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { OracleSafety } from '../../utils/OracleSafety';

export class AttributeMutator implements DomOperator {
    category: 'structural' = 'structural';
    
    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (await OracleSafety.isProtected(target)) return false;

        return await target.evaluate((node: HTMLElement) => {
            const attributes = node.attributes;
            const applicableAttrs = ['id', 'class', 'title', 'hidden'];
            for (let i = 0; i < attributes.length; i++) {
                const name = attributes[i].name.toLowerCase();
                if (name === 'data-testid') continue; // Always protect
                if (applicableAttrs.includes(name)) return true;
            }
            return false;
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const mutationApplied = await target.evaluate((node: HTMLElement) => {
            const attributes = node.attributes;
            for (let i = 0; i < attributes.length; i++) {
                const attrName = attributes[i].name.toLowerCase();
                if (attrName === 'data-testid') continue;

                let val = attributes[i].value;
                switch (attrName) {
                    case 'id':
                    case 'class':
                    case 'title':
                        val += "_mutant";
                        node.setAttribute(attrName, val);
                        return { applied: true, attr: attrName, val: val };
                    case 'hidden':
                        node.removeAttribute('hidden');
                        return { applied: true, attr: 'hidden', val: 'removed' };
                }
            }
            return { applied: false };
        });

        if (mutationApplied.applied) {
            record.data = { action: 'AttributeMutator', ...mutationApplied };
        } else {
            record.addError("No applicable global attributes found to mutate (or only protected attributes present)");
        }
    }

    serialize(): { type: string, params?: any } {
        return { type: 'AttributeMutator' };
    }
}
