import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createMockedHost, type MockedHost } from '@open-iga/connector-sdk/test';
import { awsPlugin } from '../src/aws-plugin.ts';

describe('account-actions.create', () => {
    let host: MockedHost;

    beforeAll(async () => {
        host = await createMockedHost({
            plugin: awsPlugin,
            config: {
                AWS_REGION: 'us-east-1',
                AWS_ACCESS_KEY_ID: 'test',
                AWS_SECRET_ACCESS_KEY: 'test',
                AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL ?? '',
                AWS_USER_CREATION_ROLE: 'arn:aws:iam::000000000000:role/openiga-user-creation',
            },
            mockUpstream: process.env.FLOCI_ENDPOINT_URL ?? '',
        });
    });

    afterAll(async () => {
        await host.close();
    });

    it('should create an iam user', async () => {
        const result = await host.callAccountActions('iam-user', 'create', {
            email: `test.user@openiga.dev`,
            firstname: 'test',
            lastname: 'user',
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(typeof result.output.id).toBe('string');
            expect(result.output.id.length).toBeGreaterThan(0);
        }
    });

    it('should return an error for a duplicate email', async () => {
        const email = `test.dup-user@openiga.dev`;
        const firstname = 'test';
        const lastname = 'dup-user';

        const first = await host.callAccountActions('iam-user', 'create', { email, firstname, lastname });
        expect(first.ok).toBe(true);

        const second = await host.callAccountActions('iam-user', 'create', {
            email,
            firstname,
            lastname,
        });

        expect(second.ok).toBe(false);
        if (!second.ok) {
            expect(second.error).toContain('409');
        }
    });

    // it('rejects invalid input before reaching the upstream', async () => {
    //     const result = await host.callAccountActions('iam-user', 'create', {
    //         email: 'not-an-email',
    //         firstname: 'Foo',
    //         lastname: 'Bar',
    //     });
    //
    //     expect(result.ok).toBe(false);
    //     if (!result.ok) {
    //         expect(result.error).toContain('validation');
    //     }
    // });
    //
    // it('fails when a required action config is missing', async () => {
    //     const hostWithoutRole = await createMockedHost(awsPlugin, pluginConfig(), {}, { allowedDomainsInTest: ['localhost'] });
    //
    //     const result = await hostWithoutRole.callAccountActions('iam-user', 'create', {
    //         email: 'no-role@openiga.dev',
    //         firstname: 'Foo',
    //         lastname: 'Bar',
    //     });
    //
    //     expect(result.ok).toBe(false);
    //     if (!result.ok) {
    //         expect(result.error).toContain('AWS_USER_CREATION_ROLE');
    //     }
    //
    //     await hostWithoutRole.close();
    // });
});
