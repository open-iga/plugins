/**
 * Guest-runtime `fetch` polyfill. The extism-js (QuickJS) engine performs host-backed
 * HTTP through the synchronous `Http.request` global rather than a `fetch` function, so
 * fetch-based connector code and libraries (e.g. aws4fetch) have nothing to call.
 *
 * This maps the subset of `fetch` connectors use — `(url, { method, headers, body })`
 * returning an object with `status`, `ok`, `text()` and `json()` — onto `Http.request`.
 * Response headers are not surfaced because `Http.request` does not expose them.
 */
declare const Http: {
    request(
        req: { url: string; method?: string; headers?: Record<string, string | number | boolean> },
        body?: string | ArrayBufferLike,
    ): { body: string; status: number };
};

type FetchInit = {
    method?: string;
    headers?: { forEach(cb: (value: string, key: string) => void): void } | Record<string, string>;
    body?: string | null;
};

interface FetchResponse {
    readonly status: number;
    readonly ok: boolean;
    text(): Promise<string>;
    json(): Promise<unknown>;
}

const toHeaderRecord = (headers: FetchInit['headers']): Record<string, string> => {
    const record: Record<string, string> = {};
    if (!headers) return record;

    if (typeof (headers as { forEach?: unknown }).forEach === 'function') {
        (headers as { forEach(cb: (value: string, key: string) => void): void }).forEach((value, key) => {
            record[key] = value;
        });
    } else {
        for (const key of Object.keys(headers)) record[key] = (headers as Record<string, string>)[key]!;
    }
    return record;
};

export const installFetch = () => {
    if (typeof (globalThis as { fetch?: unknown }).fetch === 'function') return;

    const polyfillFetch = async (input: string | { url?: string }, init: FetchInit = {}): Promise<FetchResponse> => {
        const url = typeof input === 'string' ? input : (input?.url ?? '');
        const method = String(init.method ?? 'GET').toUpperCase();
        const headers = toHeaderRecord(init.headers);
        const body = init.body ?? undefined;

        const response = Http.request({ url, method, headers }, body ?? undefined);
        const status = response.status;

        return {
            status,
            ok: status >= 200 && status < 300,
            text: async () => response.body,
            json: async () => JSON.parse(response.body),
        };
    };

    (globalThis as unknown as { fetch: unknown }).fetch = polyfillFetch;
};
