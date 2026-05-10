import { DomOperator } from '../dom/DomOperator';

// Visual operators share the same interface as DomOperator in this architecture
// as they also manipulate the DOM to achieve visual effects (e.g. styles)
export interface VisualOperator extends DomOperator {
}
