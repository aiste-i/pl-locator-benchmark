import { Page, Locator } from 'playwright';
import { MutationRecord } from '../../MutationRecord';

export interface DomOperator {
    category: 'structural' | 'content' | 'accessibility-semantic' | 'visibility';
    oracleAnchorSafe?: boolean;
    isApplicable(page: Page, target: Locator): Promise<boolean>;
    applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void>;
    serialize(): { type: string, params?: any };
}
