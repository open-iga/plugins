import type { OpenIgaPlugin } from './plugin.ts';

/**
 * Runtime half of the dispatcher. No validation — that happens at build time
 * (see the build-time collector). `ids` is the build-validated set,
 * inlined into the generated entry as a literal. Handlers themselves can't be
 * serialized to code, so they ride in via the imported `plugin`.
 */
export const createRuntimeDispatcher = (plugin: OpenIgaPlugin<any>) => {
    // Extism export contract: no args, returns I32 (0 = ok, 1 = error).
    // Input via Host.inputString(); output via Host.outputString().
    return (): 0 | 1 => {
        try {
            const { id } = JSON.parse(Host.inputString() || '{}') as { id?: string };
            const action = id ? plugin.registry.get(id) : undefined;
            if (!action) {
                Host.outputString(JSON.stringify({ error: `No account action registered for "${id}"` }));
                return 1;
            }

            const pluginConfig = buildConfig(plugin.settings.config);
            const actionConfig = action.config ? buildConfig(action.config) : {};
            const config = { ...pluginConfig, ...actionConfig };

            return action.handler({ config });
        } catch (error) {
            Host.outputString(JSON.stringify({ error: String(error) }));
            return 1;
        }
    };
};

/** Read the Host-provided config for the plugin's declared vars; enforce required. */
const buildConfig = (configSpec: { name: string; required: boolean }[]): Record<string, string> => {
    const config: Record<string, string> = {};
    for (const { name, required } of configSpec) {
        const value = Config.get(name);
        if (required && !value) {
            throw new Error(`Config "${name}" is required but missing from the Host config`);
        }
        if (value != null) config[name] = value;
    }
    return config;
};
