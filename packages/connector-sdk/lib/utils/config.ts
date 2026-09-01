/** Read the Host-provided config for the connector's declared config */
export const buildConfig = (configSpec: { name: string; required: boolean }[]): Record<string, string | null> => {
    const config: Record<string, string | null> = {};
    for (const { name, required } of configSpec) {
        const value = Config.get(name);

        if (required && !value) {
            throw new Error(`Config "${name}" is required but missing from the Host config`);
        }

        config[name] = value;
    }
    return config;
};
