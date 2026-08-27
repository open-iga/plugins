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

const isHmacSha256KeyAlgo = (algorithm: unknown): boolean => {
    const algo = algorithm as { name?: string; hash?: string | { name?: string } };
    const hashName = typeof algo?.hash === 'string' ? algo.hash : algo?.hash?.name;
    return algo?.name === 'HMAC' && hashName === 'SHA-256';
};

interface HmacKey {
    __hmacKey: Uint8Array;
}

/**
 * Guest-runtime WebCrypto HMAC polyfill. The engine implements `crypto.subtle.digest`
 * and `crypto.getRandomValues` but NOT `importKey`/`sign`, so keyed HMAC via WebCrypto
 * is unavailable. This polyfill is to support use-cases like aws4fetch.
 * In the future, if more use-cases are required in the SDK, consider polyfill directly from connector
 * */
export const installWebCryptoHmac = () => {
    const cryptoObj = (globalThis as unknown as { crypto?: { subtle?: Record<string, unknown> } }).crypto;
    const subtle = cryptoObj?.subtle;
    if (!subtle) throw new Error('installWebCryptoHmac: crypto.subtle is unavailable in this runtime');

    // Real WebCrypto present (e.g. under Bun at build time) — leave it alone.
    if (typeof subtle.sign === 'function' && typeof subtle.importKey === 'function') return;

    subtle.importKey = async (_format: string, keyData: SourceData, algorithm: unknown): Promise<HmacKey> => {
        if (!isHmacSha256KeyAlgo(algorithm)) {
            throw new Error('installWebCryptoHmac: only { name: "HMAC", hash: "SHA-256" } keys are supported');
        }
        return { __hmacKey: toBytes(keyData) };
    };

    subtle.sign = async (algorithm: unknown, key: HmacKey, data: SourceData): Promise<ArrayBuffer> => {
        if (!(algorithm === 'HMAC' || (algorithm as { name?: string })?.name === 'HMAC')) {
            throw new Error('installWebCryptoHmac: only HMAC signing is supported');
        }
        const mac = hmac(sha256, key.__hmacKey, toBytes(data));
        return mac.buffer.slice(mac.byteOffset, mac.byteOffset + mac.byteLength) as ArrayBuffer;
    };
};
