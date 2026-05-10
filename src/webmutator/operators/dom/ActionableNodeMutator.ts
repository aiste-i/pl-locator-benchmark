import { Page, Locator } from 'playwright';
import { DomOperator } from './DomOperator';
import { MutationRecord } from '../../MutationRecord';
import { OracleSafety } from '../../utils/OracleSafety';

export class ActionableNodeMutator implements DomOperator {
    category: 'accessibility-semantic' = 'accessibility-semantic';
    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (await OracleSafety.isProtected(target)) return false;

        return await target.evaluate((node: HTMLElement) => {
            const tag = node.tagName.toLowerCase();
            if (tag === 'a') {
                return Boolean(node.getAttribute('href') || (node.textContent || '').trim().length > 0);
            }

            if (tag === 'input' || tag === 'button') {
                return ['id', 'class', 'title'].some(attr => Boolean(node.getAttribute(attr)));
            }

            return false;
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const result = await target.evaluate((node: HTMLElement) => {
            const tag = node.tagName.toLowerCase();
            if (tag === 'a') {
                const href = node.getAttribute('href');
                if (href) {
                    node.setAttribute('href', href + "#mutant");
                    return { action: 'anchor-href' };
                }
                const text = node.textContent || "";
                node.textContent = text + "_mutant";
                return { action: 'anchor-text' };
            } else if (tag === 'input' || tag === 'button') {
                // Global attribute mutation logic
                const attrs = ['id', 'class', 'title'];
                for (const attr of attrs) {
                    const val = node.getAttribute(attr);
                    if (val) {
                        node.setAttribute(attr, val + "_mutant");
                        return { action: 'input-attr', attr };
                    }
                }
            }
            return null;
        });

        if (result) {
            record.data = { ...result, operator: 'ActionableNodeMutator' };
        } else {
            record.addError("No mutation applicable for this actionable node");
        }
    }

    serialize(): { type: string, params?: any } {
        return { type: 'ActionableNodeMutator' };
    }
}

