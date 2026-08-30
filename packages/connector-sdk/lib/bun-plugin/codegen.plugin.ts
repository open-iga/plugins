import type { BunPlugin } from 'bun';
import * as path from 'node:path';
import { OUT_DIR, type BuildContext } from '../cli/compile.ts';
import { validateAndGenerateConnectorManifest } from './validation/manifest.ts';

/**
 * Virtual id used as the Bun.build entrypoint. Not a real file — the codegen plugin
 * below intercepts it and generates its source in memory.
 */
export const VIRTUAL_ENTRY = 'openiga-connector';

// extism-js reads this interface file to know the guest's export (dispatch) and the
// Host capability imports it must wire. Every host function a connector may call has to be
// declared here or the import stays unresolved and the wasm fails to instantiate.
const staticTypeFile = `
    declare module 'main' {
        export function dispatch(): I32
    }

    declare module 'extism:host' {
        interface user {
            sendEmail(offset: I64): I64
        }
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
        const manifest = validateAndGenerateConnectorManifest(mod.default);

        const connectorName = manifest.name;
        ctx.connectorName = connectorName;

        build.onResolve({ filter: new RegExp(`^${VIRTUAL_ENTRY}$`) }, () => ({
            path: VIRTUAL_ENTRY,
            namespace: 'openiga',
        }));

        build.onLoad({ filter: /.*/, namespace: 'openiga' }, async () => {
            return {
                loader: 'ts',
                contents: [
                    `import connector from ${JSON.stringify(authorAbs)};`,
                    `import { createRuntimeDispatcher } from '@open-iga/connector-sdk/internals';`,
                    `const _dispatch = createRuntimeDispatcher(connector);`,
                    `export function dispatch() { return _dispatch(); }`,
                ].join('\n'),
            };
        });

        // Since both the manifest and the .d.ts are fully known before the build runs and
        // don't depend on the newBundlePath output. The wasm plugin's onEnd reads the .d.ts,
        // so producing it up front avoids racing that hook (onEnd callbacks across plugins aren't ordered).
        await Bun.write(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
        await Bun.write(path.join(OUT_DIR, `${connectorName}.d.ts`), staticTypeFile);
    },
});
