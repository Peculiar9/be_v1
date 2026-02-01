import { AsyncLocalStorage } from 'async_hooks';

export interface IRequestContext {
    ipAddress: string;
    userAgent: string;
    user?: any; // Optional, populated after authentication
}

export class RequestContext {
    // The static storage instance
    private static storage = new AsyncLocalStorage<IRequestContext>();

    // Method to start a new context (called by middleware)
    public static run<T>(context: IRequestContext, callback: () => T): T {
        return this.storage.run(context, callback);
    }

    // Method to get the entire context object
    public static get(): IRequestContext | undefined {
        return this.storage.getStore();
    }

    // Helper getters for convenience
    public static getIpAddress(): string {
        return this.storage.getStore()?.ipAddress || 'unknown';
    }

    public static getUserAgent(): string {
        return this.storage.getStore()?.userAgent || 'unknown';
    }
}
