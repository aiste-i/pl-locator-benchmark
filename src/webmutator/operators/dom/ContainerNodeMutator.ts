import { Page, Locator } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { MutationTargetSafety } from '../../utils/MutationTargetSafety';
import { OracleSafety } from '../../utils/OracleSafety';

export class ContainerNodeMutator implements DomOperator {
    category: 'structural' = 'structural';
    oracleAnchorSafe = true;
    private containerTags = ["body", "div", "span", "table", "td", "tr", "ul", "li"];

    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        const protectionKind = await OracleSafety.getProtectionKind(target);
        if (protectionKind === 'contains-anchor-descendant') return false;
        if (protectionKind === 'direct-anchor' && !this.oracleAnchorSafe) return false;
        if (await MutationTargetSafety.isInteractiveOrEssential(target)) return false;
        if (await MutationTargetSafety.containsInteractiveOrEssentialDescendants(target)) return false;
        return await target.evaluate((node: HTMLElement, tags) => {
            const tag = node.tagName.toLowerCase();
            const text = node.textContent || '';
            return tags.includes(tag) && node.children.length === 0 && text.trim().length > 0;
        }, this.containerTags);
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const mutated = await target.evaluate((node: HTMLElement, tags) => {
            const tag = node.tagName.toLowerCase();
            if (tags.includes(tag) && node.children.length === 0) {
                const text = node.textContent || "";
                if (text.trim().length > 0) {
                    node.textContent = text + "_mutant";
                    return true;
                }
            }
            return false;
        }, this.containerTags);

        if (mutated) {
            record.data = { action: 'ContainerNodeMutator' };
        } else {
            record.addError("Not a leaf container node with text");
        }
    }

    serialize(): { type: string, params?: any } {
        return { type: 'ContainerNodeMutator' };
    }
}

