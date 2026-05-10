import { Page, Locator } from 'playwright';
import { MutationMode } from './MutationMode';
import { MutationRecord } from './MutationRecord';
import { DomOperator } from './operators/dom/DomOperator';
import { evaluateMutationApplicability } from './operators/applicability';
import { getImmediateElementHandle } from '../utils/locator-handles';

export class WebMutator {
    mutationMode: MutationMode;

    constructor(mutationMode: MutationMode = MutationMode.DOM) {
        this.mutationMode = mutationMode;
    }

    async applyMutation(page: Page, selector: string, operator: DomOperator): Promise<MutationRecord> {
        try {
            const target = page.locator(selector).first();
            const applicability = await evaluateMutationApplicability(page, target, operator);
            if (!applicability.applicable) {
                return MutationRecord.fromError(`Mutation skipped: ${applicability.reason} for selector ${selector}`);
            }

            const targetHandle = await getImmediateElementHandle(target);

            const record = new MutationRecord(true);
            record.originalXpath = selector; // Using selector as identifier for now
            record.operator = operator.constructor.name;

            await operator.applyOperator(page, target, record);
            
            // Best-effort mutation marker. Structural operators may replace or move the node,
            // so re-resolving the original selector can block on a now-stale path.
            if (targetHandle) {
                try {
                    await targetHandle.evaluate((node: HTMLElement) => {
                        node.setAttribute('mutation', 'yes');
                        node.setAttribute('mutationoperator', 'applied');
                    });
                } catch {
                    // Ignore detached-node marking failures; the mutation itself already ran.
                } finally {
                    await targetHandle.dispose().catch(() => undefined);
                }
            }

            return record;
        } catch (error: any) {
            return MutationRecord.fromError(error.message);
        }
    }
}
