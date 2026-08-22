import type { BunPlugin } from 'bun';
import * as path from 'node:path';
import { OUT_DIR, type BuildContext } from '../cli/build.ts';
import type * as z from 'zod/mini';
import { pluginAccountActionSchema } from '../validation-schema/plugin.account-action.schema.ts';
import { OpenIgaPlugin } from '../iga-plugin/plugin.ts';
import type { PluginConfig } from '../validation-schema/plugin.config.schema.ts';

/**
 * Virtual id used as the Bun.build entrypoint. Not a real file — the codegen plugin
 * below intercepts it and generates its source in memory.
 */
export const VIRTUAL_ENTRY = 'openiga-plugin';

const staticTypeFile = `
    declare module 'main' {
        export function dispatch(): I32
    }
`;

type Manifest = {
    name: string;
    description: string;
    config: PluginConfig;
    actions: ({ id: string } & Pick<
        z.infer<typeof pluginAccountActionSchema>,
        'description' | 'endpoints' | 'config'
    >)[];
};

/**
 * There are two levels of validation: build and runtime
 * Build-time validates the registry. Runtime is part of dispatcher that sits between the host and the plugin
 * */
const validateAndGeneratePluginManifest = (plugin: unknown): Manifest => {
    if (!(plugin instanceof OpenIgaPlugin)) {
        throw new Error(`Default export should be an instance of ${OpenIgaPlugin.name}`);
    }

    const { name, config, description } = plugin.settings;
    const manifest: Manifest = { name, description, config, actions: [] };

    [...plugin.registry].forEach(([name, action]) => {
        const [managedResource, actionName] = plugin.getAccountActionsDetails(name);

        const result = pluginAccountActionSchema.safeParse(action);
        if (!result.success) {
            const reason = result.error.issues.map((issue) => issue.message).join('; ');
            throw new Error(
                `Validation failed for action type ${actionName} in the managed resource ${managedResource}. Reason: ${reason}`,
            );
        }

        const { endpoints, description, config } = result.data;
        manifest.actions.push({ id: name, endpoints, description, config: config ?? [] });
    });

    return manifest;
};

/**
 * Codegen exposes a single entry point that acts as a dispatcher which host invokes
 * */
export const codegenPlugin = (authorEntryPath: string, ctx: BuildContext): BunPlugin => ({
    name: 'open-iga-codegen',
    async setup(build) {
        const authorAbs = path.resolve(authorEntryPath);
        const mod = await import(authorAbs);
        const manifest = validateAndGeneratePluginManifest(mod.default);

        const pluginName = manifest.name;
        ctx.pluginName = pluginName;

        build.onResolve({ filter: new RegExp(`^${VIRTUAL_ENTRY}$`) }, () => ({
            path: VIRTUAL_ENTRY,
            namespace: 'openiga',
        }));

        build.onLoad({ filter: /.*/, namespace: 'openiga' }, async () => {
            return {
                loader: 'ts',
                contents: [
                    `import plugin from ${JSON.stringify(authorAbs)};`,
                    `import { createRuntimeDispatcher } from '@open-iga/plugin-core/internals';`,
                    `const _dispatch = createRuntimeDispatcher(plugin);`,
                    `export function dispatch() { return _dispatch(); }`,
                ].join('\n'),
            };
        });

        // Written here in setup since both the manifest and the .d.ts are
        // fully known before the build runs and don't depend on the newBundlePath output.
        // The wasm plugin's onEnd reads the .d.ts, so producing it up front avoids
        // racing that hook (onEnd callbacks across plugins aren't ordered).
        await Bun.write(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
        await Bun.write(path.join(OUT_DIR, `${pluginName}.d.ts`), staticTypeFile);
    },
});
