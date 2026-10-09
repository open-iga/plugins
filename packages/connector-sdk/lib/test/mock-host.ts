// Bun's extism build has supportsWasiPreview1: false, so the Node ESM build is
// required. Resolve via require.resolve — the package's `exports` map blocks deep
// subpath imports, and a hardcoded relative node_modules path breaks under
// isolated (symlinked) install layouts.
import { createRequire } from 'node:module';
import type { OpenIgaConnector, RuntimeConfig } from '../iga/connector/builder.ts';
import * as path from 'node:path';
import { OUT_DIR } from '../cli/compile.ts';
import type { ConnectorConfig } from '../iga/connector/validation-schema/connector.config.schema.ts';
import type { ConnectorAccountAction } from '../iga/connector/validation-schema/connector.account-action.schema.ts';
import type { ConnectorEntitlement } from '../iga/connector/validation-schema/connector.entitlement.schema.ts';
import { z } from 'zod/mini';
import type { handlerInputOutputSchema } from '../iga/connector/validation-schema/connector.account-action-handler.schema.ts';
import type { entitlementHandlerInputOutputSchema } from '../iga/connector/validation-schema/connector.entitlement-handler.schema.ts';
import type { LogLevel } from '@extism/extism';
import { createFetchProxy } from './mock-fetch.ts';
import type { EmailPayload } from '../iga/capabilities/email.schema.ts';

export type MockedHostResult<Type extends ConnectorAccountAction['type']> =
    | { ok: true; output: z.infer<(typeof handlerInputOutputSchema)[Type]['output']> }
    | { ok: false; error: string };

export type MockedEntitlementResult<Type extends ConnectorEntitlement['type']> =
    | { ok: true; output: z.infer<(typeof entitlementHandlerInputOutputSchema)[Type]['output']> }
    | { ok: false; error: string };

export type MockedHost = {
    callAccountActions: <Type extends ConnectorAccountAction['type']>(
        managedResource: string,
        type: Type,
        // Validation is performed by the dispatcher
        input: z.infer<(typeof handlerInputOutputSchema)[Type]['input']>,
    ) => Promise<MockedHostResult<Type>>;
    // `input` is optional so operations with no input fields (e.g. discover) can be called
    // without passing an empty object; grant/revoke inputs are still validated by the dispatcher.
    callEntitlements: <Type extends ConnectorEntitlement['type']>(
        managedResource: string,
        type: Type,
        input?: z.infer<(typeof entitlementHandlerInputOutputSchema)[Type]['input']>,
    ) => Promise<MockedEntitlementResult<Type>>;
    hostFunctions: {
        sentEmails: EmailPayload[];
    };
    close: () => Promise<void>;
};

// TODO: best would be to consume the execution plane from the core. Replace this in the future
export const createMockedHost = async <const Config extends ConnectorConfig>({
    plugin,
    config,
    logLevel,
    mockUpstream,
}: {
    plugin: OpenIgaConnector<Config>;
    /**
     * Both plugin config and handler config.
     * Make sure to provide valid config here. Dispatcher would fail if some of the required configs are missing
     * */
    config: RuntimeConfig<Config> & Record<string, string>;
    mockUpstream: string;
    logLevel?: LogLevel;
}): Promise<MockedHost> => {
    const wasmPath = path.join(process.cwd(), OUT_DIR, `${plugin.settings.name}.wasm`);
    const proxy = createFetchProxy(mockUpstream, config);

    const require = createRequire(import.meta.url);
    const extismEsmMod = path.join(path.dirname(require.resolve('@extism/extism')), '..', 'esm', 'mod.js');
    const { createPlugin } = (await import(extismEsmMod)) as typeof import('@extism/extism');

    // Records what the connector passed to the Host email capability so tests can assert on it.
    const sentEmails: EmailPayload[] = [];

    const wasmPlugin = await createPlugin(wasmPath, {
        useWasi: true,
        allowedHosts: plugin.settings.allowedDomains,
        logLevel: logLevel ?? 'info',
        // Config is delivered per invocation in the dispatch envelope, not as ambient Extism config.
        fetch: proxy.fetch as typeof fetch,
        functions: {
            // Namespace must match the guest import (extism:host/user).
            'extism:host/user': {
                // Guest passes the payload by memory offset; read it, record it, report success (0).
                sendEmail: (callContext, offset: bigint) => {
                    const payload = callContext.read(offset)?.json() as EmailPayload | undefined;
                    if (payload) sentEmails.push(payload);
                    return 0n;
                },
            },
        },
    });

    return {
        callAccountActions: async (managedResource, type, input) => {
            proxy.setAllowedEndpoint(plugin.accountActionsRegistry.get(managedResource)?.get(type)?.endpoints ?? []);

            const out = await wasmPlugin.call(
                'dispatch',
                JSON.stringify({
                    __kind: 'account-action',
                    __managedResource: managedResource,
                    __type: type,
                    config,
                    input,
                }),
            );
            if (!out) {
                return { ok: false, error: 'no output' };
            }

            const parsed = out.json();
            return 'error' in parsed ? { ok: false, error: String(parsed.error) } : { ok: true, output: parsed };
        },

        callEntitlements: async (managedResource, type, input) => {
            proxy.setAllowedEndpoint(plugin.entitlementRegistry.get(managedResource)?.get(type)?.endpoints ?? []);

            const out = await wasmPlugin.call(
                'dispatch',
                JSON.stringify({
                    __kind: 'entitlement',
                    __managedResource: managedResource,
                    __type: type,
                    config,
                    input: input ?? {},
                }),
            );
            if (!out) {
                return { ok: false, error: 'no output' };
            }

            const parsed = out.json();
            return 'error' in parsed ? { ok: false, error: String(parsed.error) } : { ok: true, output: parsed };
        },

        hostFunctions: { sentEmails },
        close: () => wasmPlugin.close(),
    };
};
