export class MutationRecord {
    success: boolean;
    error?: string;
    operator?: string;
    originalDom?: string;
    originalXpath?: string;
    data?: any;
    mutatedXpath?: string;

    constructor(success: boolean, error?: string) {
        this.success = success;
        this.error = error;
    }

    static fromSuccess(operator: string, originalXpath: string, data?: any): MutationRecord {
        const record = new MutationRecord(true);
        record.operator = operator;
        record.originalXpath = originalXpath;
        record.data = data;
        return record;
    }

    static fromError(error: string): MutationRecord {
        return new MutationRecord(false, error);
    }

    addError(message: string): void {
        this.success = false;
        this.error = message;
    }
}
