/**
 * Guest-runtime `Headers` polyfill. The extism-js (QuickJS) engine exposes `Http.request`
 * but none of the Fetch primitives, so `new Headers(...)` — which fetch-based libraries
 * (e.g. aws4fetch) and the SDK's own `Request` polyfill rely on — is undefined.
 *
 * Header names are case-insensitive and stored lowercased, matching the Fetch spec, so
 * SigV4 canonicalization (which lowercases and sorts header names) stays correct.
 */
type HeadersInit = PolyfillHeaders | Record<string, string> | [string, string][];

class PolyfillHeaders {
    private readonly map = new Map<string, string>();

    constructor(init?: HeadersInit | null) {
        if (!init) return;

        if (typeof (init as PolyfillHeaders).forEach === 'function' && !Array.isArray(init)) {
            (init as PolyfillHeaders).forEach((value, key) => this.append(key, value));
        } else if (Array.isArray(init)) {
            for (const [key, value] of init) this.append(key, value);
        } else {
            for (const key of Object.keys(init)) this.append(key, (init as Record<string, string>)[key]!);
        }
    }

    append(name: string, value: string): void {
        const key = name.toLowerCase();
        const existing = this.map.get(key);
        this.map.set(key, existing === undefined ? String(value) : `${existing}, ${value}`);
    }

    set(name: string, value: string): void {
        this.map.set(name.toLowerCase(), String(value));
    }

    get(name: string): string | null {
        const value = this.map.get(name.toLowerCase());
        return value === undefined ? null : value;
    }

    has(name: string): boolean {
        return this.map.has(name.toLowerCase());
    }

    delete(name: string): void {
        this.map.delete(name.toLowerCase());
    }

    forEach(callback: (value: string, key: string, parent: PolyfillHeaders) => void): void {
        this.map.forEach((value, key) => callback(value, key, this));
    }

    keys(): IterableIterator<string> {
        return this.map.keys();
    }

    values(): IterableIterator<string> {
        return this.map.values();
    }

    entries(): IterableIterator<[string, string]> {
        return this.map.entries();
    }

    [Symbol.iterator](): IterableIterator<[string, string]> {
        return this.map.entries();
    }
}

export const installHeaders = () => {
    if (typeof (globalThis as { Headers?: unknown }).Headers === 'function') return;
    (globalThis as unknown as { Headers: unknown }).Headers = PolyfillHeaders;
};
