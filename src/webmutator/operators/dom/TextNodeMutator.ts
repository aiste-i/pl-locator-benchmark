import { Page, Locator } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { RandomUtils } from '../../utils/RandomUtils';

export class TextNodeMutator implements DomOperator {
    category: 'content' = 'content';
    oracleAnchorSafe = true;
    
    async isApplicable(page: Page, target: Locator): Promise<boolean> { const text = await target.innerText(); return text.trim().length > 0; }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const mutated = await target.evaluate((node: HTMLElement) => {
            const text = node.textContent;
            if (text && text.trim().length > 0) {
                // Mimic StringMutator.getMutant logic roughly (appending/modifying)
                node.textContent = text + "_mutant";
                return true;
            }
            return false;
        });

        if (mutated) {
            record.data = { action: 'TextNodeMutator' };
        } else {
            record.addError("Node text was empty");
        }
    }

    serialize(): { type: string, params?: any } {
        return { type: 'TextNodeMutator' };
    }
}


