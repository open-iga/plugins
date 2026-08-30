import type { BunPlugin } from 'bun';
import * as path from 'node:path';
import { existsSync, renameSync } from 'node:fs';
import { OUT_DIR, type BuildContext } from '../cli/compile.ts';
import { VIRTUAL_ENTRY } from './codegen.plugin.ts';
import { Logger } from '../utils/logger.ts';

const log = new Logger('wasm');

const ULEB128_LSB = 0x7f;
const ULEB128_MSB = 0x80;

const CUSTOM_SECTION_NAME = 'openiga:manifest';
const CUSTOM_SECTION_ID = 0x00;

/**
 * ULEB128: Unsigned Little Endian Base 128
 * Design: https://github.com/WebAssembly/design/discussions/1533
 *
 * Encoding:
 *  - Extract the lowest seven bits -> Perform Bitwise AND between LSB and the input
 *  - Right shift the input by 7 (since Base 128 = 2^7)
 *  - If the input is not Zero, perform bitwise OR between the input and MSB
 *  - Repeat the above the until the input becomes zero
 *
 * Decoding is performed by WASM runtime
 *
 * Notes:
 * 0x7f = LSB 127 (0111 1111)
 * 0x80 = MSB 128 (1000 0000)
 * Right shift factor: 7
 * */
const uleb128Encoder = (input: number): number[] => {
    const out: number[] = [];
    do {
        let b = input & ULEB128_LSB;
        input >>>= 7;
        if (input !== 0) {
            b |= ULEB128_MSB;
        }
        out.push(b);
    } while (input !== 0);
    return out;
};

/**
 * Converts the size into uleb128 encoded and includes the payload into the custom section
 *
 * Structure: Section ID -> Section length (ULEB128) -> Name length (ULEB128) -> Name (in bytes) -> Payload (bytes)
 *
 * Section ID:
 * 0x00 = Custom Section
 * 0x01 = Type Section
 * 0x02 = Import Section
 * 0x03 = Function Section
 * 0x04 = Table Section
 * 0x05 = Memory Section
 * 0x06 = Global Section
 * 0x07 = Export Section
 * 0x08 = Start Section
 * 0x09 = Element Section
 * 0x0A = Code Section
 * 0x0B = Data Section
 * */
const customSection = (name: string, payload: Uint8Array): Uint8Array => {
    const nameBytes = new TextEncoder().encode(name);
    const body = [...uleb128Encoder(nameBytes.length), ...nameBytes, ...payload];
    return new Uint8Array([CUSTOM_SECTION_ID, ...uleb128Encoder(body.length), ...body]);
};

/**
 * Extract WASM and include the manifest through custom section
 * */
const includeManifestInManifest = async ({
    wasmFilePath,
    manifestFilePath,
}: {
    wasmFilePath: string;
    manifestFilePath: string;
}) => {
    const wasmBytes = new Uint8Array(await Bun.file(wasmFilePath).arrayBuffer());
    const manifestBytes = new Uint8Array(await Bun.file(manifestFilePath).arrayBuffer());
    const section = customSection(CUSTOM_SECTION_NAME, manifestBytes);

    const newWasmBytes = new Uint8Array(wasmBytes.length + section.length);
    newWasmBytes.set(wasmBytes, 0);
    newWasmBytes.set(section, wasmBytes.length);
    await Bun.write(wasmFilePath, newWasmBytes);
};

const compileToWasm = ({
    emittedBundlePath,
    wasmFilePath,
    dtsFilePath,
    newBundlePath,
}: {
    emittedBundlePath: string;
    dtsFilePath: string;
    wasmFilePath: string;
    newBundlePath: string;
}) => {
    // Validate codegen produced artifacts
    const missing = [emittedBundlePath, dtsFilePath].filter((file) => !existsSync(file));
    if (missing.length > 0) {
        throw new Error(
            `wasm: codegen artifacts missing (${missing.join(', ')}). ` +
                `Ensure the codegen plugin runs before wasmPlugin in the plugins array.`,
        );
    }

    // Ensure extism-js is available.
    const extism = Bun.which('extism-js');
    if (!extism) {
        throw new Error('wasm: `extism-js` not found on PATH. Install it — https://github.com/extism/js-pdk');
    }

    // Rename JS to <connectorName>.js, then compile.
    renameSync(emittedBundlePath, newBundlePath);
    log.info('compiling', path.basename(newBundlePath), '→', path.basename(wasmFilePath));
    const proc = Bun.spawnSync([extism, newBundlePath, '-i', dtsFilePath, '-o', wasmFilePath]);
    if (proc.exitCode !== 0) {
        throw new Error(`wasm: extism-js failed (exit ${proc.exitCode})\n${proc.stderr.toString()}`);
    }

    log.info('wasm ready:', wasmFilePath);
};

/**
 * Converts the bundled code from {@link codegenPlugin} into WASM
 * On top this, includes the manifest in WASM file as custom section
 */
export const wasmPlugin = (ctx: BuildContext): BunPlugin => ({
    name: 'wasm',
    setup(build) {
        build.onEnd(async () => {
            const pluginName = ctx.connectorName;
            if (!pluginName) {
                throw new Error('wasm: connectorName not set — codegen plugin must run first');
            }

            const emittedBundlePath = path.join(OUT_DIR, `${VIRTUAL_ENTRY}.js`);
            const dtsFilePath = path.join(OUT_DIR, `${pluginName}.d.ts`);
            const newBundlePath = path.join(OUT_DIR, `${pluginName}.js`);
            const wasmFilePath = path.join(OUT_DIR, `${pluginName}.wasm`);
            const manifestFilePath = path.join(OUT_DIR, 'manifest.json');

            compileToWasm({
                emittedBundlePath,
                dtsFilePath,
                wasmFilePath,
                newBundlePath,
            });

            await includeManifestInManifest({ wasmFilePath, manifestFilePath });
        });
    },
});
