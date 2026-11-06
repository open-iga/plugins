/**
 * Guest-runtime `fetch` polyfill. The extism-js (QuickJS) engine has no `fetch` function, so
 * fetch-based connector code and libraries (e.g. aws4fetch) have nothing to call.
 *
 * This maps the subset of `fetch` connectors use — `(url, { method, headers, body })`
 * returning an object with `status`, `ok`, `text()` and `json()` — onto the Host's `fetch`
 * capability. The Host owns egress (allowed domains + the operation's declared endpoints);
 * Extism's built-in `Http.request` is disabled by the Host.
 * Response headers are not surfaced because the Host does not return them.
 */
// JSON the Host `fetch` capability returns; `error` is set when the Host denied or failed the request.
interface HostFetchResponse {
    status: number;
    body: string;
    error?: string;
}

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
    // Always override: newer extism-js ships its own `fetch` over the built-in `Http.request`, which the Host disables.
    const polyfillFetch = async (input: string | { url?: string }, init: FetchInit = {}): Promise<FetchResponse> => {
        const url = typeof input === 'string' ? input : (input?.url ?? '');
        const method = String(init.method ?? 'GET').toUpperCase();
        const headers = toHeaderRecord(init.headers);
        const body = init.body ?? undefined;

        const request = Memory.fromString(JSON.stringify({ url, method, headers, body: body ?? '' }));
        let response: HostFetchResponse;
        try {
            const responseOffset = Host.getFunctions().fetch(request.offset);
            if (!responseOffset) throw new Error(`fetch to ${url} failed: the Host returned no response`);
            const responseMemory = Memory.find(responseOffset);
            try {
                response = responseMemory.readJsonObject<HostFetchResponse>();
            } finally {
                responseMemory.free();
            }
        } finally {
            request.free();
        }
        if (response.error) throw new Error(response.error);

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
