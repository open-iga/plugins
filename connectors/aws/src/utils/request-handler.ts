// The retry logic of the client does an `instanceof` check on this global, which the wasm runtime lacks.
(globalThis as { ReadableStream?: unknown }).ReadableStream ??= class ReadableStream {};

type HttpRequest = {
    protocol: string;
    hostname: string;
    port?: number;
    path: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
};

// Sends client requests through `fetch`, because the default transport needs streams and timers.
export const requestHandler = {
    handle: async ({ protocol, hostname, port, path, method, headers, body }: HttpRequest) => {
        const url = `${protocol}//${hostname}${port ? `:${port}` : ''}${path}`;
        const response = await fetch(url, { method, headers, ...(body ? { body } : {}) });
        const responseBody = new TextEncoder().encode(await response.text());

        return { response: { statusCode: response.status, headers: {}, body: responseBody } };
    },
};
