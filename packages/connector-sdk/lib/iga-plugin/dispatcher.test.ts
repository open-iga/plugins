import { describe, it, expect, beforeEach } from 'bun:test';
import { createRuntimeDispatcher } from './dispatcher.ts';
import { type AccountAction, OpenIgaPlugin } from './plugin.ts';
import type { PluginConfig } from './validation-schema/plugin.config.schema.ts';

/**
 * The dispatcher talks to the Extism host via the `Host` and `Config` globals.
 * They are stubbed here so the handler runs under Bun without the WASM runtime.
 */
let hostInput = '';
let hostOutput = '';
let hostConfig: Record<string, string> = {};

const setHostInput = (value: unknown) => {
    hostInput = JSON.stringify(value);
};

const readHostOutput = () => JSON.parse(hostOutput);

const validInput = {
    email: 'test.user@openiga.dev',
    firstname: 'test',
    lastname: 'user',
};

const buildPlugin = (handler: AccountAction['handler'] = () => ({ id: 'user-1' }), config: PluginConfig = []) =>
    new OpenIgaPlugin({
        name: 'plugin',
        description: 'desc',
        config,
        allowedDomains: ['domain.com'],
    }).registerAccountActions('iam-user', {
        type: 'create',
        description: 'create user',
        endpoints: [{ method: 'POST', url: 'https://domain.com', description: 'endpoint' }],
        handler,
    });

const pluginId = 'iam-user.account-action.create';

describe('createRuntimeDispatcher', () => {
    beforeEach(() => {
        hostInput = '';
        hostOutput = '';
        hostConfig = {};

        (globalThis as any).Host = {
            inputString: () => hostInput,
            outputString: (value: string) => {
                hostOutput = value;
            },
        };
        (globalThis as any).Config = {
            get: (name: string) => hostConfig[name] ?? null,
        };
    });

    it('should throw error if the __pluginId is not provided by the host', async () => {
        const dispatch = createRuntimeDispatcher(buildPlugin());
        setHostInput({ ...validInput });

        const code = await dispatch();

        expect(code).toBe(1);
        expect(readHostOutput().error).toMatch(/Dispatcher internals validation error/);
    });

    it('should throw error if the __pluginId is missing in the registry', async () => {
        const dispatch = createRuntimeDispatcher(buildPlugin());
        setHostInput({ __pluginId: 'unknown.account-action.create', ...validInput });

        const code = await dispatch();

        expect(code).toBe(1);
        expect(readHostOutput().error).toMatch(/No account action registered for "unknown.account-action.create"/);
    });

    it('should throw error if the input in handler is invalid', async () => {
        const dispatch = createRuntimeDispatcher(buildPlugin());
        // email is not a valid email address
        setHostInput({ __pluginId: pluginId, email: 'not-an-email', firstname: 'test', lastname: 'user' });

        const code = await dispatch();

        expect(code).toBe(1);
        expect(readHostOutput().error).toMatch(/Host input validation error/);
    });

    it('should throw error if the required config from the plugin is missing', async () => {
        const dispatch = createRuntimeDispatcher(
            buildPlugin(() => ({ id: 'user-1' }) as never, [{ name: 'REGION', description: 'region', required: true }]),
        );
        setHostInput({ __pluginId: pluginId, ...validInput });
        // REGION intentionally left out of hostConfig

        const code = await dispatch();

        expect(code).toBe(1);
        expect(readHostOutput().error).toMatch(/Config "REGION" is required but missing/);
    });

    it('should throw error if the output from handler is not valid', async () => {
        // handler returns an object missing the required `id`
        const dispatch = createRuntimeDispatcher(buildPlugin(() => ({}) as never));
        setHostInput({ __pluginId: pluginId, ...validInput });

        const code = await dispatch();

        expect(code).toBe(1);
        expect(readHostOutput().error).toMatch(/Plugin response validation error/);
    });

    it('should return the validated handler output on success', async () => {
        const dispatch = createRuntimeDispatcher(
            buildPlugin(
                ({ config, input }) => {
                    expect(config).toEqual({ REGION: 'us-east-1' });
                    expect(input.email).toBe(validInput.email);
                    return { id: 'user-1', metadata: { region: (config as { REGION: string }).REGION } } as never;
                },
                [{ name: 'REGION', description: 'region', required: true }],
            ),
        );
        hostConfig = { REGION: 'us-east-1' };
        setHostInput({ __pluginId: pluginId, ...validInput });

        const code = await dispatch();

        expect(code).toBe(0);
        expect(readHostOutput()).toEqual({ id: 'user-1', metadata: { region: 'us-east-1' } });
    });
});
