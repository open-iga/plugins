// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="../../../node_modules/@extism/js-pdk/types/polyfills.d.ts" />
// Pull in the full Extism PDK globals (Host, Memory, getFunctions) plus the SDK's host-function
// augmentation (sendEmail) so connectors consuming this env can call Host capabilities. The SDK's
// own build already loads this file, so the reference simply dedupes there.
// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="../extism-jspdk.d.ts" />

// --- fetch (GUARANTEED by the SDK polyfill over Http.request; extism omits it) ------
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

// --- Headers (GUARANTEED by the SDK polyfill; extism omits it) ----------------------
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

// --- crypto (GUARANTEED by the SDK polyfill; extism omits it entirely) --------------
// NOTE: the polyfill supports SHA-256 digest and HMAC-SHA256 sign/importKey only, and
// throws on any other algorithm; getRandomValues is best-effort (see webcrypto.ts).
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
