import * as fs from 'node:fs';
import * as path from 'node:path';
import { codegenPlugin, VIRTUAL_ENTRY } from '../bun-plugin/codegen.plugin.ts';
import { wasmPlugin } from '../bun-plugin/wasm.plugin.ts';

// Shared between plugins
export type BuildContext = {
    // Set by the codegen plugin when it imports the author entry point
    pluginName?: string;
};

export const OUT_DIR = '.open-iga';

export const compile = async ({ entryPoint }: { entryPoint?: string }) => {
    if (!entryPoint) {
        throw new Error('Missing --entryPoint');
    }

    if (!fs.existsSync(path.join(process.cwd(), entryPoint))) {
        throw new Error(`Entrypoint file ${entryPoint} does not exist`);
    }

    const buildContext: BuildContext = {};

    await Bun.build({
        entrypoints: [VIRTUAL_ENTRY],
        outdir: OUT_DIR,
        format: 'cjs',
        target: 'browser',
        minify: true,
        plugins: [codegenPlugin(entryPoint, buildContext), wasmPlugin(buildContext)],
    });
};
