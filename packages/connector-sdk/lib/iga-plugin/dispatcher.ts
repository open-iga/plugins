import type { OpenIgaPlugin } from './plugin.ts';
import * as z from 'zod/mini';
import { handlerInputOutputSchema } from '../validation-schema/plugin.account-action-handler.schema.ts';

const pluginDispatcherSchema = z.object({
    __pluginId: z.string(),
});

/**
 * Runtime dispatcher. Idea is to expose a single API which wrapper the function call
 */
export const createRuntimeDispatcher = (plugin: OpenIgaPlugin<any>) => {
    // Extism export contract: no args, returns I32 (0 = ok, 1 = error). The host
    // awaits the returned promise before reading the I32. Input via
    // Host.inputString(); output via Host.outputString().
    return async (): Promise<0 | 1> => {
        try {
            const hostInput = JSON.parse(Host.inputString());

            const { __pluginId } = z.parse(pluginDispatcherSchema, hostInput);
            const action = plugin.registry.get(__pluginId);
            if (!action) {
                Host.outputString(JSON.stringify({ error: `No account action registered for "${__pluginId}"` }));
                return 1;
            }

            const { input, output } = handlerInputOutputSchema[action.type];

            const parsedInput = z.parse(input, hostInput);
            const pluginConfig = buildConfig(plugin.settings.config);
            const actionConfig = action.config ? buildConfig(action.config) : {};
            const config = { ...pluginConfig, ...actionConfig };

            const result = await action.handler({ config, input: parsedInput });

            const parsedResult = z.parse(output, result);

            Host.outputString(JSON.stringify(parsedResult));
            return 0;
        } catch (error) {
            Host.outputString(JSON.stringify({ error: String(error) }));
            return 1;
        }
    };
};

/** Read the Host-provided config for the plugin's declared vars; enforce required. */
const buildConfig = (configSpec: { name: string; required: boolean }[]): Record<string, string> => {
    const config: Record<string, string> = {};
    for (const { name, required } of configSpec) {
        const value = Config.get(name);
        if (required && !value) {
            throw new Error(`Config "${name}" is required but missing from the Host config`);
        }
        if (value != null) config[name] = value;
    }
    return config;
};
