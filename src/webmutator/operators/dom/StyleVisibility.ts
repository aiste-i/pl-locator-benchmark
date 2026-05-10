import { Page, Locator } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { MutationTargetSafety } from '../../utils/MutationTargetSafety';

export class StyleVisibility implements DomOperator {
    category: 'visibility' = 'visibility';
    
    async isApplicable(page: Page, target: Locator): Promise<boolean> { 
        return await MutationTargetSafety.isSafeVisibilityTarget(target);
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const newVal = await target.evaluate((node: HTMLElement) => {
            node.style.opacity = node.style.opacity === '0.35' ? '1' : '0.35';
            return node.style.opacity;
        });

        record.data = { action: 'StyleVisibility', opacity: newVal };
    }

    serialize(): { type: string, params?: any } {
        return { type: 'StyleVisibility' };
    }
}
