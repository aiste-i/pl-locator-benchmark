import { Page, Locator } from 'playwright';
import { VisualOperator } from './VisualOperator';
import { MutationRecord } from '../../MutationRecord';

export class MaskMutator implements VisualOperator {
    category: 'visibility' = 'visibility';

    async isApplicable(_page: Page, target: Locator): Promise<boolean> {
        return (await target.count()) > 0;
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        await target.evaluate((node: HTMLElement) => {
            node.style.backgroundColor = 'black';
            node.style.color = 'black';
            node.style.visibility = 'visible';
            node.style.opacity = '1';
        });

        record.data = { action: 'MaskMutator' };
    }

    serialize(): { type: string; params?: any } {
        return { type: 'MaskMutator' };
    }
}
