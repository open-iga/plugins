import createPlugin from '@extism/extism';
import type { OpenIgaPlugin, RuntimeConfig } from '../iga-plugin/plugin.ts';
import * as path from 'node:path';
import { OUT_DIR } from '../cli/build.ts';
import type { PluginConfig } from '../iga-plugin/validation-schema/plugin.config.schema.ts';
import type { PluginAccountAction } from '../iga-plugin/validation-schema/plugin.account-action.schema.ts';
import { z } from 'zod/mini';
import type { handlerInputOutputSchema } from '../iga-plugin/validation-schema/plugin.account-action-handler.schema.ts';

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
export const createMockedHost = async <const Config extends PluginConfig>(
    plugin: OpenIgaPlugin<Config>,
    config: RuntimeConfig<Config>,
    // Make sure to provide valid config here. Dispatcher would fail if some of the required config are missing
    actionConfig: Record<string, string> = {},
): Promise<MockedHost> => {
    const wasmPath = path.join(process.cwd(), OUT_DIR, `${plugin.settings.name}.wasm`);

    const wasmPlugin = await createPlugin(wasmPath, {
        useWasi: true,
        allowedHosts: plugin.settings.allowedDomains,
        config: {
            ...(Object.fromEntries(Object.entries(config).filter(([, v]) => v != null)) as Record<string, string>),
            ...actionConfig,
        },
    });

    return {
        callAccountActions: async (managedResource, type, input) => {
            const out = await wasmPlugin.call(
                'dispatch',
                JSON.stringify({
                    __pluginId: plugin.createAccountActionId(managedResource, type),
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
