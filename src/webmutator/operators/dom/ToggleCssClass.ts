import { Locator, Page } from 'playwright';
import { MutationRecord } from '../../MutationRecord';
import { OracleSafety } from '../../utils/OracleSafety';
import { DomOperator } from './DomOperator';

export class ToggleCssClass implements DomOperator {
    category: 'visibility' = 'visibility';

    async isApplicable(page: Page, target: Locator): Promise<boolean> {
        if (await OracleSafety.isProtected(target)) return false;

        return await target.evaluate((node: HTMLElement) => {
            if (node.hasAttribute('data-testid')) return false;
            return node instanceof HTMLElement;
        });
    }

    async applyOperator(page: Page, target: Locator, record: MutationRecord): Promise<void> {
        const mutation = await target.evaluate((node: HTMLElement) => {
            const originalClassName = node.className;
            let action = 'add-benchmark-muted';

            if (node.classList.contains('btn-primary')) {
                node.classList.remove('btn-primary');
                node.classList.add('btn-outline-primary');
                action = 'btn-primary-to-outline';
            } else if (node.classList.contains('btn-outline-primary')) {
                node.classList.remove('btn-outline-primary');
                node.classList.add('btn-primary');
                action = 'btn-outline-to-primary';
            } else if (node.classList.contains('active')) {
                node.classList.remove('active');
                action = 'remove-active';
            } else if (node.classList.contains('disabled')) {
                node.classList.remove('disabled');
                action = 'remove-disabled';
            } else {
                node.classList.add('benchmark-muted');
            }

            return {
                action,
                originalClassName,
                newClassName: node.className,
            };
        });

        record.data = {
            type: 'ToggleCssClass',
            ...mutation,
        };
    }

    serialize(): { type: string; params?: any } {
        return { type: 'ToggleCssClass' };
    }
}
