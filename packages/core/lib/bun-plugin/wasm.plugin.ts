import type { BunPlugin } from 'bun';
import * as path from 'node:path';
import { existsSync, renameSync } from 'node:fs';
import { OUT_DIR, type BuildContext } from '../cli/build.ts';
import { VIRTUAL_ENTRY } from './codegen.plugin.ts';
import { Logger } from '../utils/logger.ts';

const log = new Logger('wasm');

/**
 * Compiles the codegen bundle to wasm via extism-js.
 *
 * Must run AFTER the codegen plugin in the `plugins` array — it depends on the
 * bundle + d.ts that step produces, and on `ctx.pluginName` (set by codegen's
 * setup). Guards first: verify the name is published, the artifacts exist, and
 * extism-js is installed; then rename the JS to <pluginName>.js and compile.
 */
export const wasmPlugin = (ctx: BuildContext): BunPlugin => ({
    name: 'wasm',
    setup(build) {
        build.onEnd(async () => {
            const pluginName = ctx.pluginName;
            if (!pluginName) {
                throw new Error('wasm: pluginName not set — codegen plugin must run first');
            }

            const emittedBundle = path.join(OUT_DIR, `${VIRTUAL_ENTRY}.js`);
            const dts = path.join(OUT_DIR, `${pluginName}.d.ts`);
            const bundle = path.join(OUT_DIR, `${pluginName}.js`);
            const wasm = path.join(OUT_DIR, `${pluginName}.wasm`);

            // 1. Validate codegen produced what we need.
            const missing = [emittedBundle, dts].filter((file) => !existsSync(file));
            if (missing.length > 0) {
                throw new Error(
                    `wasm: codegen artifacts missing (${missing.join(', ')}). ` +
                        `Ensure the codegen plugin runs before wasmPlugin in the plugins array.`,
                );
            }

            // 2. Ensure extism-js is available.
            const extism = Bun.which('extism-js');
            if (!extism) {
                throw new Error('wasm: `extism-js` not found on PATH. Install it — https://github.com/extism/js-pdk');
            }

            // 3. Rename JS to <pluginName>.js, then compile.
            renameSync(emittedBundle, bundle);
            log.info('compiling', path.basename(bundle), '→', path.basename(wasm));
            const proc = Bun.spawnSync([extism, bundle, '-i', dts, '-o', wasm]);
            if (proc.exitCode !== 0) {
                throw new Error(`wasm: extism-js failed (exit ${proc.exitCode})\n${proc.stderr.toString()}`);
            }

            log.info('wasm ready:', wasm);
        });
    },
});
