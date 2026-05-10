import { Page, Locator } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { MutationTargetSafety } from '../../utils/MutationTargetSafety';

export class StyleSize implements DomOperator {
    category: 'visibility' = 'visibility';
    
    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        return await MutationTargetSafety.isSafeVisibilityTarget(target);
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const transform = await target.evaluate((node: HTMLElement) => {
            const nextTransform = node.style.transform === 'scale(1.12)' ? 'scale(0.88)' : 'scale(1.12)';
            node.style.transform = nextTransform;
            node.style.transformOrigin = 'center center';
            return nextTransform;
        });

        record.data = { action: 'StyleSize', transform };
    }

    serialize(): { type: string, params?: any } {
        return { type: 'StyleSize' };
    }
}

