import type { PluginAccountAction } from '../validation-schema/plugin.account-action.schema.ts';
import type { PluginConfig } from '../validation-schema/plugin.config.schema.ts';
import type { handlerInputOutputSchema } from '../validation-schema/plugin.account-action-handler.schema.ts';
import type * as z from 'zod/mini';

type SimplifiedRuntimeConfig<Type> = { [Property in keyof Type]: Type[Property] };
type RuntimeConfig<Config extends PluginConfig = PluginConfig> = SimplifiedRuntimeConfig<
    {
        [Key in Extract<Config[number], { required: true }>['name']]: string;
    } & {
        [Key in Extract<Config[number], { required: false }>['name']]: string | null;
    }
>;

export type AccountAction<
    Config extends PluginConfig = PluginConfig,
    ActionConfig extends PluginConfig = [],
    Type extends PluginAccountAction['type'] = PluginAccountAction['type'],
> = Pick<PluginAccountAction, 'type' | 'description' | 'endpoints'> & {
    // Optional action-level config, on top of the plugin-level config.
    config?: ActionConfig;
    handler: (context: {
        // Plugin-level and action-level config, both resolved and merged.
        input: z.infer<(typeof handlerInputOutputSchema)[Type]['input']>;
        config: SimplifiedRuntimeConfig<RuntimeConfig<Config> & RuntimeConfig<ActionConfig>>;
    }) =>
        | z.infer<(typeof handlerInputOutputSchema)[Type]['output']>
        | Promise<z.infer<(typeof handlerInputOutputSchema)[Type]['output']>>;
};

export class OpenIgaPlugin<const Config extends PluginConfig> {
    // TODO: extend the registry to include entitlements
    readonly registry = new Map<string, AccountAction<Config, PluginConfig>>();
    private readonly accountActionDelimiter = '.account-action.';

    // TODO: validate setting with validation schema
    constructor(readonly settings: { name: string; description: string; config: Config }) {}

    registerAccountActions<const ActionConfig extends PluginConfig = []>(
        managedResource: string,
        action: AccountAction<Config, ActionConfig>,
    ) {
        this.registry.set(`${managedResource}${this.accountActionDelimiter}${action.type}`, action);

        return this;
    }

    getAccountActionsDetails = (name: string): [string, string] => {
        const split = name.split(this.accountActionDelimiter);
        if (split.length !== 2) {
            throw new Error(`Unable to get managed resource details for ${name}`);
        }

        return [split[0]!, split[1]!];
    };
}
