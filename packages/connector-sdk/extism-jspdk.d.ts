// Repo-wide Extism JS PDK ambient globals (Host, ConnectorConfig, Http, Var, ...).
// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="../../node_modules/@extism/js-pdk/dist/index.d.ts" />

// Host capabilities the runtime provides to connectors. These are wasm imports the Host
// resolves; the same signatures are emitted into the generated interface .d.ts so `extism-js`
// wires the import at compile time (see codegen.plugin.ts).
declare module 'extism:host' {
    interface user {
        // offset of a JSON EmailPayload in wasm memory -> 0 ok / non-zero failure
        sendEmail(offset: I64): I64;
    }
}
