import { Locator } from '@playwright/test';
import { getImmediateElementHandle } from '../../utils/locator-handles';

export type OracleProtectionKind = 'none' | 'direct-anchor' | 'contains-anchor-descendant';

export class OracleSafety {
    static async getProtectionKind(locator: Locator): Promise<OracleProtectionKind> {
        const handle = await getImmediateElementHandle(locator);
        if (!handle) {
            return 'none';
        }

        try {
            return await handle.evaluate((node: HTMLElement) => {
                const ORACLE_ATTR = 'data-testid';

                if (node.hasAttribute(ORACLE_ATTR)) return 'direct-anchor';
                if (node.querySelector(`[${ORACLE_ATTR}]`)) return 'contains-anchor-descendant';
                return 'none';
            });
        } catch {
            return 'none';
        } finally {
            await handle.dispose().catch(() => undefined);
        }
    }

    /**
     * Checks if a target node (represented by a locator) is part of the oracle-grounded context.
     * A node is oracle-protected if it is an oracle node itself OR an ancestor of an oracle node
     * whose mutation would invalidate oracle grounding.
     */
    static async isProtected(locator: Locator): Promise<boolean> {
        return (await this.getProtectionKind(locator)) !== 'none';
    }

    /**
     * Checks if a structural mutation on a target node would threaten oracle integrity.
     */
    static async isStructuralMutationUnsafe(locator: Locator): Promise<boolean> {
        // For structural mutations (delete, move, swap), we must be extremely strict.
        return await this.isProtected(locator);
    }

    /**
     * Checks if a visibility mutation on a target node would threaten oracle integrity.
     */
    static async isVisibilityMutationUnsafe(locator: Locator): Promise<boolean> {
        // If we hide a node that contains an oracle, the oracle becomes non-actionable/invisible.
        return await this.isProtected(locator);
    }
}
