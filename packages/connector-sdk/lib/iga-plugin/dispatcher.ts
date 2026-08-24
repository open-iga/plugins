import type { OpenIgaPlugin } from './plugin.ts';
import * as z from 'zod/mini';
import { handlerInputOutputSchema } from '../validation-schema/plugin.account-action-handler.schema.ts';
import { installRuntimePolyfills } from '../polyfills/installer.ts';
import { buildConfig } from '../utils/config.ts';

const pluginDispatcherSchema = z.object({
    __pluginId: z.string(),
});

const prettyZodError = (error: z.core.$ZodError) => z.prettifyError(error);

/**
 * Runtime dispatcher. Idea is to expose a single API which wrapper the function call
 */
export const createRuntimeDispatcher = (plugin: OpenIgaPlugin<any>) => {
    // Guarantee the runtime globals connectors rely on (Request, WebCrypto HMAC).
    installRuntimePolyfills();

    // Extism export contract: no args, returns I32 (0 = ok, 1 = error)
    return async (): Promise<0 | 1> => {
        try {
            const hostInput = JSON.parse(Host.inputString());

            const pluginDispatcherResult = z.safeParse(pluginDispatcherSchema, hostInput);
            if (pluginDispatcherResult.error) {
                throw new Error(
                    `Dispatcher internals validation error: ${prettyZodError(pluginDispatcherResult.error)}`,
                );
            }
            const { __pluginId } = pluginDispatcherResult.data;

            const action = plugin.registry.get(__pluginId);
            if (!action) {
                Host.outputString(JSON.stringify({ error: `No account action registered for "${__pluginId}"` }));
                return 1;
            }

            const { input, output } = handlerInputOutputSchema[action.type];

            const hostInputResult = z.safeParse(input, hostInput);
            if (hostInputResult.error) {
                throw new Error(`Host input validation error: ${prettyZodError(hostInputResult.error)}`);
            }

            const pluginConfig = buildConfig(plugin.settings.config);
            const actionConfig = action.config ? buildConfig(action.config) : {};
            const config = Object.freeze({ ...pluginConfig, ...actionConfig });

            const pluginOutput = await action.handler({
                config: config as Parameters<typeof action.handler>[0]['config'],
                input: hostInputResult.data,
            });

            const pluginOutputResult = z.safeParse(output, pluginOutput);
            if (pluginOutputResult.error) {
                throw new Error(`Plugin response validation error: ${prettyZodError(pluginOutputResult.error)}`);
            }

            Host.outputString(JSON.stringify(pluginOutputResult.data));
            return 0;
        } catch (error) {
            Host.outputString(JSON.stringify({ error: String(error) }));
            return 1;
        }
    };
};
