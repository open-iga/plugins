import type { ConnectorAccountAction } from './validation-schema/connector.account-action.schema.ts';
import type { ConnectorConfig } from './validation-schema/connector.config.schema.ts';
import type { handlerInputOutputSchema } from './validation-schema/connector.account-action-handler.schema.ts';
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

export class OpenIgaConnector<const Config extends ConnectorConfig> {
    // TODO: extend the registry to include entitlements
    readonly registry = new Map<string, AccountAction<Config, ConnectorConfig>>();
    private readonly accountActionDelimiter = '.account-action.';

    constructor(readonly settings: Omit<ConnectorSettings, 'config'> & { config: Config }) {}

    registerAccountActions<
        const ActionConfig extends ConnectorConfig = [],
        const Type extends ConnectorAccountAction['type'] = ConnectorAccountAction['type'],
    >(managedResource: string, action: AccountAction<Config, ActionConfig, Type>) {
        // The registry is type-erased over Type/ActionConfig; the dispatcher validates at runtime.
        this.registry.set(
            this.createAccountActionId(managedResource, action.type),
            action as unknown as AccountAction<Config, ConnectorConfig>,
        );

        return this;
    }

    createAccountActionId(managedResource: string, type: AccountAction['type']) {
        return `${managedResource}${this.accountActionDelimiter}${type}`;
    }

    getAccountActionsDetails = (name: string): [string, string] => {
        const split = name.split(this.accountActionDelimiter);
        if (split.length !== 2) {
            throw new Error(`Unable to get managed resource details for ${name}`);
        }

        return [split[0]!, split[1]!];
    };
}
