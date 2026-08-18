import type { z } from 'zod';
import type { pluginAccountActionSchema } from '../validation-schema/plugin.account-action.schema.ts';
import type { PluginConfig } from '../validation-schema/plugin.config.schema.ts';

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
> = Pick<z.infer<typeof pluginAccountActionSchema>, 'type' | 'description' | 'endpoints'> & {
    // Optional action-level config, on top of the plugin-level config.
    config?: ActionConfig;
    handler: (context: {
        // Plugin-level and action-level config, both resolved and merged.
        config: SimplifiedRuntimeConfig<RuntimeConfig<Config> & RuntimeConfig<ActionConfig>>;
    }) => 0 | 1;
};

export class OpenIgaPlugin<const Config extends PluginConfig> {
    // TODO: extend the registry after introducing entitlements
    readonly registry = new Map<string, AccountAction<Config, PluginConfig>>();
    private readonly accountActionDelimiter = '.account-action.';

    // TODO: validate setting with validation schema
    constructor(readonly settings: { name: string; description: string; config: Config }) {}

    registerAccountActions<const ActionConfig extends PluginConfig = []>(
        managedResource: string,
        action: AccountAction<Config, ActionConfig>,
    ) {
        this.registry.set(
            `${managedResource}${this.accountActionDelimiter}${action.type}`,
            action as AccountAction<Config, PluginConfig>,
        );

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
