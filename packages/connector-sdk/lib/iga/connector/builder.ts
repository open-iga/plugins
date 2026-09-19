import type { ConnectorAccountAction } from './validation-schema/connector.account-action.schema.ts';
import type { ConnectorConfig } from './validation-schema/connector.config.schema.ts';
import type { handlerInputOutputSchema } from './validation-schema/connector.account-action-handler.schema.ts';
import type { ConnectorEntitlement } from './validation-schema/connector.entitlement.schema.ts';
import type { entitlementHandlerInputOutputSchema } from './validation-schema/connector.entitlement-handler.schema.ts';
import type * as z from 'zod/mini';
import type { ConnectorSettings } from './validation-schema/connector.settings.schema.ts';

type SimplifiedRuntimeConfig<Type> = { [Property in keyof Type]: Type[Property] };
export type RuntimeConfig<Config extends ConnectorConfig = ConnectorConfig> = SimplifiedRuntimeConfig<
    {
        [Key in Extract<Config[number], { required: true }>['name']]: string;
    } & {
        [Key in Extract<Config[number], { required: false }>['name']]: string | null;
    }
>;

export type AccountAction<
    Config extends ConnectorConfig = ConnectorConfig,
    ActionConfig extends ConnectorConfig = [],
    Type extends ConnectorAccountAction['type'] = ConnectorAccountAction['type'],
> = Pick<ConnectorAccountAction, 'description' | 'endpoints'> & {
    type: Type;
    config?: ActionConfig;
    handler: (context: {
        input: z.infer<(typeof handlerInputOutputSchema)[Type]['input']>;
        config: Readonly<SimplifiedRuntimeConfig<RuntimeConfig<Config> & RuntimeConfig<ActionConfig>>>;
    }) =>
        | z.infer<(typeof handlerInputOutputSchema)[Type]['output']>
        | Promise<z.infer<(typeof handlerInputOutputSchema)[Type]['output']>>;
};

// Entitlement operation registered on the connector (parallel to an AccountAction). Input/output
// are keyed off the entitlement handler schema by operation type (discover/grant/revoke).
export type Entitlement<
    Config extends ConnectorConfig = ConnectorConfig,
    ActionConfig extends ConnectorConfig = [],
    Type extends ConnectorEntitlement['type'] = ConnectorEntitlement['type'],
> = Pick<ConnectorEntitlement, 'description' | 'endpoints'> & {
    type: Type;
    config?: ActionConfig;
    handler: (context: {
        input: z.infer<(typeof entitlementHandlerInputOutputSchema)[Type]['input']>;
        config: Readonly<SimplifiedRuntimeConfig<RuntimeConfig<Config> & RuntimeConfig<ActionConfig>>>;
    }) =>
        | z.infer<(typeof entitlementHandlerInputOutputSchema)[Type]['output']>
        | Promise<z.infer<(typeof entitlementHandlerInputOutputSchema)[Type]['output']>>;
};

export class OpenIgaConnector<const Config extends ConnectorConfig> {
    // Keyed managed resource → operation type → operation, mirroring the manifest shape.
    readonly accountActionsRegistry = new Map<string, Map<string, AccountAction<Config, ConnectorConfig>>>();
    readonly entitlementRegistry = new Map<string, Map<string, Entitlement<Config, ConnectorConfig>>>();

    constructor(readonly settings: Omit<ConnectorSettings, 'config'> & { config: Config }) {}

    registerAccountActions<
        const ActionConfig extends ConnectorConfig = [],
        const Type extends ConnectorAccountAction['type'] = ConnectorAccountAction['type'],
    >(managedResource: string, action: AccountAction<Config, ActionConfig, Type>) {
        // The registry is type-erased over Type/ActionConfig; the dispatcher validates at runtime.
        const accountActionConfigByType =
            this.accountActionsRegistry.get(managedResource) ??
            new Map<string, AccountAction<Config, ConnectorConfig>>();
        accountActionConfigByType.set(action.type, action as unknown as AccountAction<Config, ConnectorConfig>);
        this.accountActionsRegistry.set(managedResource, accountActionConfigByType);

        return this;
    }

    registerEntitlements<
        const ActionConfig extends ConnectorConfig = [],
        const Type extends ConnectorEntitlement['type'] = ConnectorEntitlement['type'],
    >(managedResource: string, entitlement: Entitlement<Config, ActionConfig, Type>) {
        const entitlementConfigByType =
            this.entitlementRegistry.get(managedResource) ?? new Map<string, Entitlement<Config, ConnectorConfig>>();
        entitlementConfigByType.set(entitlement.type, entitlement as unknown as Entitlement<Config, ConnectorConfig>);
        this.entitlementRegistry.set(managedResource, entitlementConfigByType);

        return this;
    }
}
