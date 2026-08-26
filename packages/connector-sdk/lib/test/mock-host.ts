// Bun capability has supportsWasiPreview1: false, so importing from NodeJS ESM
import { createPlugin } from '../../../../node_modules/@extism/extism/dist/esm/mod.js';
import type { OpenIgaPlugin, RuntimeConfig } from '../iga-plugin/plugin.ts';
import * as path from 'node:path';
import { OUT_DIR } from '../cli/compile.ts';
import type { PluginConfig } from '../iga-plugin/validation-schema/plugin.config.schema.ts';
import type { PluginAccountAction } from '../iga-plugin/validation-schema/plugin.account-action.schema.ts';
import { z } from 'zod/mini';
import type { handlerInputOutputSchema } from '../iga-plugin/validation-schema/plugin.account-action-handler.schema.ts';
import type { LogLevel } from '@extism/extism';
import { createFetchProxy } from './mock-fetch.ts';

export type MockedHostResult<Type extends PluginAccountAction['type']> =
    | { ok: true; output: z.infer<(typeof handlerInputOutputSchema)[Type]['output']> }
    | { ok: false; error: string };

export type MockedHost<Type extends PluginAccountAction['type'] = PluginAccountAction['type']> = {
    callAccountActions: (
        managedResource: string,
        type: Type,
        // Validation is performed by the dispatcher
        input: z.infer<(typeof handlerInputOutputSchema)[Type]['input']>,
    ) => Promise<MockedHostResult<Type>>;
    close: () => Promise<void>;
};

// TODO: best would be to consume the execution plane from the core. Replace this in the future
export const createMockedHost = async <const Config extends PluginConfig>({
    plugin,
    config,
    logLevel,
    mockUpstream,
}: {
    plugin: OpenIgaPlugin<Config>;
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

    const wasmPlugin = await createPlugin(wasmPath, {
        useWasi: true,
        allowedHosts: plugin.settings.allowedDomains,
        logLevel: logLevel ?? 'info',
        config,
        fetch: proxy.fetch as typeof fetch,
    });

    return {
        callAccountActions: async (managedResource, type, input) => {
            const pluginId = plugin.createAccountActionId(managedResource, type);

            proxy.setAllowedEndpoint(plugin.registry.get(pluginId)?.endpoints ?? []);

            const out = await wasmPlugin.call(
                'dispatch',
                JSON.stringify({
                    __pluginId: pluginId,
                    ...input,
                }),
            );
            if (!out) {
                return { ok: false, error: 'no output' };
            }

            const parsed = out.json();
            return 'error' in parsed ? { ok: false, error: String(parsed.error) } : { ok: true, output: parsed };
        },

        close: () => wasmPlugin.close(),
    };
};
