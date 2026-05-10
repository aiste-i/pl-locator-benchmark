import { Page, Locator } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { MutationTargetSafety } from '../../utils/MutationTargetSafety';

export class StylePosition implements DomOperator {
    category: 'visibility' = 'visibility';
    
    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        return await MutationTargetSafety.isSafeVisibilityTarget(target);
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const transform = await target.evaluate((node: HTMLElement) => {
            const nextTransform = node.style.transform === 'translate(24px, -12px)'
                ? 'translate(-18px, 16px)'
                : 'translate(24px, -12px)';
            node.style.position = 'relative';
            node.style.transform = nextTransform;
            return nextTransform;
        });

        record.data = { action: 'StylePosition', transform };
    }

    serialize(): { type: string, params?: any } {
        return { type: 'StylePosition' };
    }
}

