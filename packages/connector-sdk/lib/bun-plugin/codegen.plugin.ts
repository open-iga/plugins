import type { BunPlugin } from 'bun';
import * as path from 'node:path';
import { OUT_DIR, type BuildContext } from '../cli/compile.ts';
import { validateAndGeneratePluginManifest } from './validation/manifest.ts';

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
                    `import { createRuntimeDispatcher } from '@open-iga/connector-sdk/internals';`,
                    `const _dispatch = createRuntimeDispatcher(plugin);`,
                    `export function dispatch() { return _dispatch(); }`,
                ].join('\n'),
            };
        });

        // Since both the manifest and the .d.ts are fully known before the build runs and
        // don't depend on the newBundlePath output. The wasm plugin's onEnd reads the .d.ts,
        // so producing it up front avoids racing that hook (onEnd callbacks across plugins aren't ordered).
        await Bun.write(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
        await Bun.write(path.join(OUT_DIR, `${pluginName}.d.ts`), staticTypeFile);
    },
});
