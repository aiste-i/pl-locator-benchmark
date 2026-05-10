import { createCatalogOperator } from './catalog';

export class OperatorRegistry {
    static createOperator(type: string, params?: any) {
        return createCatalogOperator(type, params);
    }
}
