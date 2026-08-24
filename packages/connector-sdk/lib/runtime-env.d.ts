// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="../../../node_modules/@extism/js-pdk/types/polyfills.d.ts" />

// --- fetch (native, host-backed; extism omits it) ----------------------------------
interface FetchResponse {
    readonly status: number;
    readonly ok: boolean;
    text(): Promise<string>;
    json(): Promise<unknown>;
}
declare function fetch(
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<FetchResponse>;

// --- Headers (native; extism omits it) ---------------------------------------------
type HeadersInit = Headers | Record<string, string> | [string, string][];
interface Headers {
    append(name: string, value: string): void;
    delete(name: string): void;
    get(name: string): string | null;
    has(name: string): boolean;
    set(name: string, value: string): void;
    forEach(callback: (value: string, key: string, parent: Headers) => void): void;
}
declare var Headers: {
    new (init?: HeadersInit): Headers;
};

// --- Request (GUARANTEED by the SDK polyfill; extism omits it) ----------------------
interface Request {
    readonly url: string;
    readonly method: string;
    readonly headers: Headers;
    readonly body: string | null;
    clone(): Request;
}
declare var Request: {
    new (
        input: string | { url?: string; method?: string; headers?: HeadersInit; body?: string | null },
        init?: { method?: string; headers?: HeadersInit; body?: string | null },
    ): Request;
};

// --- crypto (digest + getRandomValues native; HMAC GUARANTEED by the SDK polyfill) --
// NOTE: signing is HMAC-SHA256 only — the polyfill throws on any other algorithm.
interface SubtleCrypto {
    digest(algorithm: string | { name: string }, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
    importKey(
        format: string,
        keyData: ArrayBuffer | ArrayBufferView,
        algorithm: unknown,
        extractable: boolean,
        keyUsages: readonly string[],
    ): Promise<unknown>;
    sign(algorithm: unknown, key: unknown, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
}
interface Crypto {
    readonly subtle: SubtleCrypto;
    getRandomValues<T extends ArrayBufferView>(array: T): T;
}
declare var crypto: Crypto;
