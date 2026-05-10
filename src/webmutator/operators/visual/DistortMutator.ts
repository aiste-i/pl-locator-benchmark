import { Page, Locator } from 'playwright';
import { VisualOperator } from './VisualOperator';
import { MutationRecord } from '../../MutationRecord';

export class DistortMutator implements VisualOperator {
    category: 'visibility' = 'visibility';

    async isApplicable(_page: Page, target: Locator): Promise<boolean> {
        return (await target.count()) > 0;
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        await target.evaluate((node: HTMLElement) => {
            node.style.filter = 'blur(5px) grayscale(100%)';
            node.style.transform = 'skew(10deg, 10deg)';
        });

        record.data = { action: 'DistortMutator' };
    }

    serialize(): { type: string; params?: any } {
        return { type: 'DistortMutator' };
    }
}
