import type { OpenIgaConnector } from './connector/builder.ts';
import * as z from 'zod/mini';
import { handlerInputOutputSchema } from './connector/validation-schema/connector.account-action-handler.schema.ts';
import { entitlementHandlerInputOutputSchema } from './connector/validation-schema/connector.entitlement-handler.schema.ts';
import { installRuntimePolyfills } from '../polyfills/installer.ts';
import { buildConfig } from '../utils/config.ts';
import type { ConnectorConfig } from './connector/validation-schema/connector.config.schema.ts';

// Dispatch envelope from the Host: routing + per-invocation config + the handler input, each in
// its own slot. `kind` disambiguates `read` (both an account-action and an entitlement). `config`
// carries only the keys the Host scoped to this operation — the isolation boundary lives Host-side.
const envelopeSchema = z.object({
    __kind: z.enum(['account-action', 'entitlement']),
    __managedResource: z.string(),
    __type: z.string(),
    config: z.record(z.string(), z.string()),
    input: z.unknown(),
});

const prettyZodError = (error: z.core.$ZodError) => z.prettifyError(error);

type ResolvedOperation = {
    handler: (context: { config: any; input: any }) => unknown;
    config?: ConnectorConfig | undefined;
    input: z.ZodMiniType;
    output: z.ZodMiniType;
};

const resolveOperation = (
    plugin: OpenIgaConnector<any>,
    { __kind, __managedResource, __type }: z.infer<typeof envelopeSchema>,
): ResolvedOperation | undefined => {
    if (__kind === 'entitlement') {
        const entitlement = plugin.entitlementRegistry.get(__managedResource)?.get(__type);
        if (!entitlement) {
            return undefined;
        }

        const { input, output } = entitlementHandlerInputOutputSchema[entitlement.type];
        return { handler: entitlement.handler, config: entitlement.config, input, output };
    }

    const action = plugin.accountActionsRegistry.get(__managedResource)?.get(__type);
    if (!action) {
        return undefined;
    }

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
            const envelopeResult = z.safeParse(envelopeSchema, JSON.parse(Host.inputString()));
            if (envelopeResult.error) {
                throw new Error(`Dispatcher internals validation error: ${prettyZodError(envelopeResult.error)}`);
            }
            const envelope = envelopeResult.data;

            const operation = resolveOperation(plugin, envelope);
            if (!operation) {
                Host.outputString(
                    JSON.stringify({
                        error: `No ${envelope.__kind} registered for "${envelope.__type}" on "${envelope.__managedResource}"`,
                    }),
                );
                return 1;
            }

            const { input, output } = operation;

            const hostInputResult = z.safeParse(input, envelope.input);
            if (hostInputResult.error) {
                throw new Error(`Host input validation error: ${prettyZodError(hostInputResult.error)}`);
            }

            // Config is scoped per invocation: module config + only this operation's declared keys,
            // both read from the envelope the Host sent for this call.
            const pluginConfig = buildConfig(plugin.settings.config, envelope.config);
            const actionConfig = operation.config ? buildConfig(operation.config, envelope.config) : {};
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
