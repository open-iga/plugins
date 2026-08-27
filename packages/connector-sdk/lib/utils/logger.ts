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
