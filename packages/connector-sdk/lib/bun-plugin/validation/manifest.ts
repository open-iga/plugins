import {
    type ConnectorAccountAction,
    connectorAccountActionSchema,
} from '../../iga/connector/validation-schema/connector.account-action.schema.ts';
import { z } from 'zod/mini';
import type { ConnectorConfig } from '../../iga/connector/validation-schema/connector.config.schema.ts';
import { OpenIgaConnector } from '../../iga/connector/builder.ts';
import { connectorSettingsSchema } from '../../iga/connector/validation-schema/connector.settings.schema.ts';

/**
 * Config Template Placeholders regex
 * */
const CONFIG_PLACEHOLDERS = /\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g;

type Manifest = {
    name: string;
    description: string;
    config: ConnectorConfig;
    allowedDomains: string[];
    actions: ({ id: string } & Pick<
        z.infer<typeof connectorAccountActionSchema>,
        'description' | 'endpoints' | 'config'
    >)[];
};

/**
 * Every config placeholder in the URL must be defined as required in the config
 * (e.g.) For http:abc.{{domain}}.com, config `domain` must be mentioned as required in the config
 * */
export const validateConfigPlaceHolder = ({
    endpoints,
    config,
}: {
    endpoints: ConnectorAccountAction['endpoints'];
    config: ConnectorConfig;
}) => {
    const userDefinedConfigSet = new Map(config.map(({ name, required }) => [name, required]));

    for (const { url } of endpoints) {
        for (const match of url.matchAll(CONFIG_PLACEHOLDERS)) {
            // 0 gives the matched value with {{ }} and 1 gives the exact key
            const configKey = match[1];

            if (!configKey) {
                return;
            }

            if (!userDefinedConfigSet.has(configKey)) {
                throw new Error(
                    `${configKey} in ${url} is missing in the config. Make sure to set this either in plugin or handler level config with required = true`,
                );
            }

            if (userDefinedConfigSet.has(configKey) && userDefinedConfigSet.get(configKey) === false) {
                throw new Error(
                    `Every config placeholder must be marked as required. ${configKey} in ${url} is defined as not required.`,
                );
            }
        }
    }
};

/**
 * There are two levels of validation: build and runtime
 * Build-time validates the registry. Runtime is part of dispatcher that sits between the host and the connector
 * */
export const validateAndGenerateConnectorManifest = (connector: unknown): Manifest => {
    if (!(connector instanceof OpenIgaConnector)) {
        throw new Error(`Default export should be an instance of ${OpenIgaConnector.name}`);
    }

    const settingsResult = z.safeParse(connectorSettingsSchema, connector.settings);
    if (!settingsResult.success) {
        throw new Error(`Validation Failed for connector setting. Reason: ${z.prettifyError(settingsResult.error)}`);
    }

    const { name, config, description, allowedDomains } = settingsResult.data;
    const manifest: Manifest = { name, description, config, allowedDomains, actions: [] };

    [...connector.registry].forEach(([name, action]) => {
        const [managedResource, actionName] = connector.getAccountActionsDetails(name);

        const result = connectorAccountActionSchema.safeParse(action);
        if (!result.success) {
            throw new Error(
                `Validation failed for action type ${actionName} in the managed resource ${managedResource}. Reason: ${z.prettifyError(result.error)}`,
            );
        }

        const { endpoints, description, config } = result.data;

        validateConfigPlaceHolder({ endpoints, config: [...settingsResult.data.config, ...(config ?? [])] });
        manifest.actions.push({ id: name, endpoints, description, config: config ?? [] });
    });

    return manifest;
};
