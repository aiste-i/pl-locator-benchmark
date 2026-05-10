import { Page, Locator } from '@playwright/test';

export type InstrumentationContext = {
    runAction: (action: () => Promise<any>, locator?: Locator) => Promise<any>;
    runAssertion: (assertion: () => Promise<any>) => Promise<any>;
    runOraclePrecheck: (precheck: () => Promise<any>) => Promise<any>;
};

export class BenchmarkedLocator {
    constructor(private locator: Locator, private context: InstrumentationContext) {}

    async fill(value: string, options?: { timeout?: number }) {
        return this.context.runAction(() => this.locator.fill(value, options), this.locator);
    }

    async click(options?: { timeout?: number }) {
        return this.context.runAction(() => this.locator.click(options), this.locator);
    }

    async check(options?: { timeout?: number }) {
        return this.context.runAction(() => this.locator.check(options), this.locator);
    }

    async press(key: string, options?: { timeout?: number }) {
        return this.context.runAction(() => this.locator.press(key, options), this.locator);
    }

    async waitFor(options?: Parameters<Locator['waitFor']>[0]) {
        return this.context.runAction(() => this.locator.waitFor(options), this.locator);
    }

    get raw(): Locator {
        return this.locator;
    }
}

export class OracleLocator {
    constructor(private locator: Locator, private context: InstrumentationContext) {}

    async assertVisible(options?: { timeout?: number }) {
        return this.context.runAssertion(async () => {
            const { expect } = await import('@playwright/test');
            await expect(this.locator).toBeVisible(options);
        });
    }

    async precheckVisible(options?: { timeout?: number }) {
        return this.context.runOraclePrecheck(async () => {
            const { expect } = await import('@playwright/test');
            await expect(this.locator).toBeVisible(options);
        });
    }

    async assertClass(regex: RegExp, options?: { timeout?: number }) {
        return this.context.runAssertion(async () => {
            const { expect } = await import('@playwright/test');
            await expect(this.locator).toHaveClass(regex, options);
        });
    }

    async assertContainsText(text: string | RegExp, options?: { timeout?: number }) {
        return this.context.runAssertion(async () => {
            const { expect } = await import('@playwright/test');
            await expect(this.locator).toContainText(text as any, options);
        });
    }

    async assertText(text: string | RegExp, options?: { timeout?: number }) {
        return this.context.runAssertion(async () => {
            const { expect } = await import('@playwright/test');
            await expect(this.locator).toHaveText(text as any, options);
        });
    }

    async assertValue(value: string | RegExp, options?: { timeout?: number }) {
        return this.context.runAssertion(async () => {
            const { expect } = await import('@playwright/test');
            await expect(this.locator).toHaveValue(value as any, options);
        });
    }

    async assertCount(count: number, options?: { timeout?: number }) {
        return this.context.runAssertion(async () => {
            const { expect } = await import('@playwright/test');
            await expect(this.locator).toHaveCount(count, options);
        });
    }

    get raw(): Locator {
        return this.locator;
    }
}

export function resolveFactoryScope(
    page: Page,
    args: any[],
): { scope: Page | Locator; remainingArgs: any[] } {
    const [firstArg, ...remainingArgs] = args;

    if (firstArg instanceof BenchmarkedLocator || firstArg instanceof OracleLocator) {
        return {
            scope: firstArg.raw,
            remainingArgs,
        };
    }

    if (
        firstArg &&
        typeof firstArg === 'object' &&
        typeof firstArg.first === 'function' &&
        typeof firstArg.locator === 'function'
    ) {
        return {
            scope: firstArg as Locator,
            remainingArgs,
        };
    }

    return {
        scope: page,
        remainingArgs: args,
    };
}
