import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createMockedHost, type MockedHost } from '@open-iga/connector-sdk/test';
import { awsConnector } from '../src/aws-connector.ts';
import { getLoginProfile } from '../src/utils/iam.ts';

describe('account-actions.create', () => {
    let host: MockedHost;

    beforeAll(async () => {
        host = await createMockedHost({
            plugin: awsConnector,
            config: {
                AWS_REGION: 'us-east-1',
                AWS_ACCESS_KEY_ID: 'test',
                AWS_SECRET_ACCESS_KEY: 'test',
                AWS_USER_CREATION_ROLE: 'arn:aws:iam::000000000000:role/openiga-user-creation',
            },
            mockUpstream: process.env.AWS_ENDPOINT_URL ?? '',
        });
    });

    afterAll(async () => {
        await host.close();
    });

    it('should create an iam user with temporary credentials', async () => {
        const email = `test.user@openiga.dev`;
        const result = await host.callAccountActions('iam-user', 'create', {
            email,
            firstname: 'test',
            lastname: 'user',
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(typeof result.output.id).toBe('string');
            expect(result.output.id.length).toBeGreaterThan(0);
        }

        // The connector must deliver credentials via the Host email capability.
        expect(host.hostFunctions.sentEmails.length).toBeGreaterThan(0);
        const sent = host.hostFunctions.sentEmails.at(-1)!;
        expect(sent.subject).toBe('Your AWS access');
        expect(sent.body).toContain('AWS Login URL:');
        expect(sent.body).toContain('Password:');

        // Prove console access was actually provisioned: the login profile exists in the
        // emulator with the forced-reset flag. The console password itself is write-only and
        // can't be read back — verifying the profile is the strongest no-real-AWS check.
        const userName = 'test.user';
        const profile = await getLoginProfile({
            endpoint: process.env.AWS_ENDPOINT_URL ?? '',
            credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
            userName,
        });
        expect(profile.userName).toBe(userName);
        expect(profile.passwordResetRequired).toBe(true);
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

    it('should reject invalid input before calling the upstream', async () => {
        const result = await host.callAccountActions('iam-user', 'create', {
            email: 'not-an-email',
            firstname: 'Foo',
            lastname: 'Bar',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain('validation');
        }
    });

    it('should fail when a required action config is missing', async () => {
        const hostWithoutRole = await createMockedHost({
            plugin: awsConnector,
            config: {
                AWS_REGION: 'us-east-1',
                AWS_ACCESS_KEY_ID: 'test',
                AWS_SECRET_ACCESS_KEY: 'test',
                // AWS_USER_CREATION_ROLE intentionally omitted
            },
            mockUpstream: process.env.AWS_ENDPOINT_URL ?? '',
        });

        const result = await hostWithoutRole.callAccountActions('iam-user', 'create', {
            email: 'no-role@openiga.dev',
            firstname: 'Foo',
            lastname: 'Bar',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain('AWS_USER_CREATION_ROLE');
        }

        await hostWithoutRole.close();
    });
});
