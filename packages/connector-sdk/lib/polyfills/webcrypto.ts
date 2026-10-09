import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

type SourceData = string | ArrayBuffer | ArrayBufferView;

const toBytes = (data: SourceData): Uint8Array => {
    if (typeof data === 'string') return utf8ToBytes(data);
    if (data instanceof Uint8Array) return data;
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return new Uint8Array(data);
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const isSha256DigestAlgo = (algorithm: unknown): boolean => {
    const name = typeof algorithm === 'string' ? algorithm : (algorithm as { name?: string })?.name;
    return name === 'SHA-256';
};

const isHmacSha256KeyAlgo = (algorithm: unknown): boolean => {
    const algo = algorithm as { name?: string; hash?: string | { name?: string } };
    const hashName = typeof algo?.hash === 'string' ? algo.hash : algo?.hash?.name;
    return algo?.name === 'HMAC' && hashName === 'SHA-256';
};

interface HmacKey {
    __hmacKey: Uint8Array;
}

/**
 * Best-effort entropy for the guest `getRandomValues` polyfill. The extism-js QuickJS
 * engine exposes no CSPRNG (no `crypto`, and WASI's `random_get` isn't bound to JS), so
 * mix the only non-deterministic signals the engine does expose — wall clock, monotonic
 * clock and `Math.random` — and hash them. This is adequate for the per-invocation
 * temporary secrets connectors generate, but it is NOT a hardware RNG; prefer a
 * Host-provided random source if one becomes available.
 */
const entropyBlock = (counter: number): Uint8Array => {
    const parts = [String(counter), String(Date.now())];
    if (typeof performance !== 'undefined') parts.push(String(performance.now()));
    for (let i = 0; i < 8; i++) parts.push(String(Math.random()));
    return sha256(utf8ToBytes(parts.join('|')));
};

type MutableSubtle = {
    digest?: (algorithm: unknown, data: SourceData) => Promise<ArrayBuffer>;
    importKey?: (format: string, keyData: SourceData, algorithm: unknown) => Promise<HmacKey>;
    sign?: (algorithm: unknown, key: HmacKey, data: SourceData) => Promise<ArrayBuffer>;
};

type MutableCrypto = {
    subtle?: MutableSubtle;
    getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
};

/**
 * Guest-runtime WebCrypto polyfill. The extism-js (QuickJS) engine ships no `crypto`
 * object at all, so fetch-signing libraries like aws4fetch — which need SHA-256
 * `digest` plus HMAC-SHA256 `importKey`/`sign` — and connector code that calls
 * `crypto.getRandomValues` both fail. This installs the minimal surface those paths
 * rely on, creating `crypto`/`crypto.subtle` when absent and filling in only the
 * members the runtime is missing (so a real WebCrypto, e.g. under Bun at build time,
 * is left untouched).
 */
export const installWebCrypto = () => {
    const globals = globalThis as unknown as { crypto?: MutableCrypto };
    if (!globals.crypto) globals.crypto = {};
    const cryptoObj = globals.crypto;
    if (!cryptoObj.subtle) cryptoObj.subtle = {};
    const subtle = cryptoObj.subtle;

    if (typeof subtle.digest !== 'function') {
        subtle.digest = async (algorithm: unknown, data: SourceData): Promise<ArrayBuffer> => {
            if (!isSha256DigestAlgo(algorithm)) {
                throw new Error('installWebCrypto: only SHA-256 digest is supported');
            }
            return toArrayBuffer(sha256(toBytes(data)));
        };
    }

    if (typeof subtle.importKey !== 'function') {
        subtle.importKey = async (_format: string, keyData: SourceData, algorithm: unknown): Promise<HmacKey> => {
            if (!isHmacSha256KeyAlgo(algorithm)) {
                throw new Error('installWebCrypto: only { name: "HMAC", hash: "SHA-256" } keys are supported');
            }
            return { __hmacKey: toBytes(keyData) };
        };
    }

    if (typeof subtle.sign !== 'function') {
        subtle.sign = async (algorithm: unknown, key: HmacKey, data: SourceData): Promise<ArrayBuffer> => {
            if (!(algorithm === 'HMAC' || (algorithm as { name?: string })?.name === 'HMAC')) {
                throw new Error('installWebCrypto: only HMAC signing is supported');
            }
            return toArrayBuffer(hmac(sha256, key.__hmacKey, toBytes(data)));
        };
    }

    if (typeof cryptoObj.getRandomValues !== 'function') {
        let counter = 0;
        cryptoObj.getRandomValues = <T extends ArrayBufferView>(array: T): T => {
            const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
            for (let offset = 0; offset < view.length;) {
                const block = entropyBlock(counter++);
                const take = Math.min(block.length, view.length - offset);
                view.set(block.subarray(0, take), offset);
                offset += take;
            }
            return array;
        };
    }
};
