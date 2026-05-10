import { getBenchmarkOperatorCatalog } from './catalog';

export class DomOperators {
    static getDomOperators() {
        return getBenchmarkOperatorCatalog().map(entry => entry.factory());
    }
}
