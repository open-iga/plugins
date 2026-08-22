// The runtime globals the plugin wasm engine provides that the es2020 lib lacks.
// Shipped by core (and pulled in transitively when a plugin imports this package)
// so plugins get a correct, PDK-free ambient environment without declaring these
// themselves. Only the safe, author-facing globals belong here — NOT the host PDK
// bridge (Host/Config/Http/Var/Memory), which authors must not touch.

interface FetchResponse {
    readonly status: number;
    readonly ok: boolean;
    text(): Promise<string>;
    json(): Promise<unknown>;
}

declare function fetch(
    url: string,
    init?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
    },
): Promise<FetchResponse>;
