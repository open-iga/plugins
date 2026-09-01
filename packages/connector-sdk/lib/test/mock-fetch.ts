import type { ConnectorAccountAction } from '../iga/connector/validation-schema/connector.account-action.schema.ts';

/**
 * Config Template Placeholders regex
 * */
const CONFIG_PLACEHOLDERS = /\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g;

/**
 * Host functionality: Every handler must specify the endpoint upfront. After approval, only these endpoint are allowed
 * The same is applicable for testing
 * */
export const createFetchProxy = (mockUpstream: string, config: Record<string, unknown>) => {
    let allowedEndpoints: ConnectorAccountAction['endpoints'] = [];

    return {
        setAllowedEndpoint: (newAllowedEndpoints: ConnectorAccountAction['endpoints']) => {
            allowedEndpoints = newAllowedEndpoints.map(({ method, description, url }) => {
                const replacedUrl = url.replace(CONFIG_PLACEHOLDERS, (substring, key: string) => {
                    if (!config[key]) {
                        throw new Error(
                            `Missing ${key} in config. The config template ${substring} in the URL ${url} cannot be replaced`,
                        );
                    }

                    return config[key] as string;
                });

                return {
                    method,
                    description,
                    url: replacedUrl,
                };
            });
        },

        fetch: (input: string | URL | Request, init?: RequestInit) => {
            const targetUrl = new URL(typeof input === 'object' && 'url' in input ? input.url : input);
            const targetMethod = init?.method ?? 'get';

            const allowed = allowedEndpoints.some(({ method, url }) => {
                const userDefinedUrl = new URL(url);

                return (
                    targetMethod.toUpperCase() === method.toUpperCase() &&
                    userDefinedUrl.protocol === targetUrl.protocol &&
                    userDefinedUrl.host === targetUrl.host &&
                    userDefinedUrl.pathname === targetUrl.pathname
                );
            });

            if (!allowed) {
                throw new Error(
                    `${targetMethod.toUpperCase()} request to ${targetUrl.toString()} is not defined on the handler. Denying the request`,
                );
            }

            const proxyTarget = new URL(targetUrl.pathname + targetUrl.search, mockUpstream);
            return fetch(proxyTarget.toString(), init);
        },
    };
};
