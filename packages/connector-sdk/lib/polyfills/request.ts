/**
 * Guest-runtime `Request` polyfill. The engine has `fetch`/`Response`/`Headers` but
 * not the `Request` constructor; fetch-based libs (e.g. aws4fetch) do `new Request(...)`.
 * */
export const installRequest = () => {
    if (typeof (globalThis as { Request?: unknown }).Request === 'function') return;

    // `Headers` is native (and typed by @types/bun here), but `HeadersInit`/`BodyInit`
    // aren't declared, so alias the shapes `new Headers(...)` accepts.
    type HeadersInit = Headers | Record<string, string> | [string, string][];

    class Request {
        readonly url: string;
        readonly method: string;
        readonly headers: Headers;
        readonly body: string | null;

        constructor(
            input: string | { url?: string; method?: string; headers?: HeadersInit; body?: string | null },
            init: { method?: string; headers?: HeadersInit; body?: string | null } = {},
        ) {
            const src = typeof input === 'string' ? {} : input;
            this.url = typeof input === 'string' ? input : (input.url ?? '');
            this.method = String(init.method ?? src.method ?? 'GET').toUpperCase();
            this.headers = new Headers(init.headers ?? src.headers ?? undefined);
            this.body = init.body ?? src.body ?? null;
        }

        clone(): Request {
            return new Request(this.url, { method: this.method, headers: this.headers, body: this.body });
        }
    }

    (globalThis as unknown as { Request: unknown }).Request = Request;
};
