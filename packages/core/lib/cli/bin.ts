#!/usr/bin/env bun

import { logger } from '../utils/logger.ts';
import { parseArgs } from 'node:util';
import { build } from './build.ts';

const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
        entryPoint: { type: 'string', short: 'e' },
    },
});

const commands: { [key: string]: (cliValues: typeof values) => Promise<void> } = {
    build,
};

const main = () => {
    const userCommand = positionals[0];
    if (!userCommand) {
        logger.error('Missing command');
        return;
    }

    const command = commands[userCommand];
    if (!command) {
        logger.error(`Invalid command: ${userCommand}. Supported commands: ${Object.keys(commands).join(', ')}`);
        return;
    }

    command(values);
};

main();
