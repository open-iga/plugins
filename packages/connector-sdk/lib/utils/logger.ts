import { ConfigError } from './error.ts';

export const logger = {
    info: (...args: any) => console.log(...args),
    warn: (...args: any) => console.warn(...args),
    error: (...args: any) => console.error(...args),
};

export class Logger {
    constructor(private readonly name: string) {}

    private get prefix() {
        return `[${this.name}]`;
    }

    info(...args: any[]) {
        console.log(this.prefix, ...args);
    }

    warn(...args: any[]) {
        console.warn(this.prefix, ...args);
    }

    error(...args: any[]) {
        console.error(this.prefix, ...args);
    }
}

/**
 * There is no process in QuickJS. This is a wrapper to get host provided config
 */
export const getConfig = (key: string, required: true): string | null => {
    const value = Config.get(key);

    if (required && !value) {
        throw new ConfigError(`Env var ${key} is marked required. But is missing in the Host config.`);
    }

    return value;
};
