import type { OpenIgaConnector } from './connector/builder.ts';
import * as z from 'zod/mini';
import { handlerInputOutputSchema } from './connector/validation-schema/connector.account-action-handler.schema.ts';
import { entitlementHandlerInputOutputSchema } from './connector/validation-schema/connector.entitlement-handler.schema.ts';
import { installRuntimePolyfills } from '../polyfills/installer.ts';
import { buildConfig } from '../utils/config.ts';
import type { ConnectorConfig } from './connector/validation-schema/connector.config.schema.ts';

const pluginDispatcherSchema = z.object({
    __pluginId: z.string(),
});

const prettyZodError = (error: z.core.$ZodError) => z.prettifyError(error);

type ResolvedOperation = {
    handler: (context: { config: any; input: any }) => unknown;
    config?: ConnectorConfig | undefined;
    input: z.ZodMiniType;
    output: z.ZodMiniType;
};

const resolveOperation = (plugin: OpenIgaConnector<any>, pluginId: string): ResolvedOperation | undefined => {
    const entitlement = plugin.entitlementRegistry.get(pluginId);
    if (entitlement) {
        const { input, output } = entitlementHandlerInputOutputSchema[entitlement.type];
        return { handler: entitlement.handler, config: entitlement.config, input, output };
    }

    const action = plugin.registry.get(pluginId);
    if (!action) return undefined;
    const { input, output } = handlerInputOutputSchema[action.type];
    return { handler: action.handler, config: action.config, input, output };
};

/**
 * Runtime dispatcher. Idea is to expose a single API which wrapper the function call
 * TODO: Return error code from the dispatcher for the Host to categorize
 */
export const createRuntimeDispatcher = (plugin: OpenIgaConnector<any>) => {
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

            const operation = resolveOperation(plugin, __pluginId);
            if (!operation) {
                Host.outputString(JSON.stringify({ error: `No operation registered for "${__pluginId}"` }));
                return 1;
            }

            const { input, output } = operation;

            const hostInputResult = z.safeParse(input, hostInput);
            if (hostInputResult.error) {
                throw new Error(`Host input validation error: ${prettyZodError(hostInputResult.error)}`);
            }

            const pluginConfig = buildConfig(plugin.settings.config);
            const actionConfig = operation.config ? buildConfig(operation.config) : {};
            const config = Object.freeze({ ...pluginConfig, ...actionConfig });

            const pluginOutput = await operation.handler({
                config,
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
