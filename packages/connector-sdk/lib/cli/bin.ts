#!/usr/bin/env bun

import { parseArgs } from 'node:util';
import { compile } from './compile.ts';

const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
        entryPoint: { type: 'string', short: 'e' },
    },
});

const commands: { [key: string]: (cliValues: typeof values) => Promise<void> } = {
    compile,
};

const main = () => {
    const userCommand = positionals[0];
    if (!userCommand) {
        throw new Error('Missing command');
    }

    const command = commands[userCommand];
    if (!command) {
        throw new Error(`Invalid command: ${userCommand}. Supported commands: ${Object.keys(commands).join(', ')}`);
    }

    command(values);
};

main();
