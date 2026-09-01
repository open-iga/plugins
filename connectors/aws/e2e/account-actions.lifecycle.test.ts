import { createMockedHost, type MockedHost } from '@open-iga/connector-sdk/test';
import { awsConnector } from '../src/aws-connector.ts';
import { getLoginProfile } from '../src/utils/iam.ts';

const endpoint = () => process.env.AWS_ENDPOINT_URL ?? '';
const credentials = { accessKeyId: 'test', secretAccessKey: 'test' };

// Does the user still have a console login profile in the emulator?
const hasLoginProfile = async (userName: string): Promise<boolean> => {
    try {
        await getLoginProfile({ endpoint: endpoint(), credentials, userName });
        return true;
    } catch (error) {
        if (String(error).includes('NoSuchEntity')) return false;
        throw error;
    }
};

describe('account-actions.lifecycle', () => {
    let host: MockedHost;

    beforeAll(async () => {
        host = await createMockedHost({
            plugin: awsConnector,
            config: {
                AWS_REGION: 'us-east-1',
                AWS_ACCESS_KEY_ID: 'test',
                AWS_SECRET_ACCESS_KEY: 'test',
                AWS_USER_CREATION_ROLE: 'arn:aws:iam::000000000000:role/openiga-user-creation',
                AWS_USER_MANAGEMENT_ROLE: 'arn:aws:iam::000000000000:role/openiga-user-management',
            },
            mockUpstream: endpoint(),
        });
    });

    afterAll(async () => {
        await host.close();
    });

    it('should create, disable, enable and delete an IAM user', async () => {
        const email = `lifecycle.user@openiga.dev`;
        // The IAM username is derived from first + last name (see the create action).
        const userName = 'life.cycle';

        // Create — user exists with a login profile.
        const created = await host.callAccountActions('iam-user', 'create', {
            email,
            firstname: 'life',
            lastname: 'cycle',
        });
        expect(created.ok).toBe(true);
        if (!created.ok) return;
        const id = created.output.id;
        expect(await hasLoginProfile(userName)).toBe(true);

        // Read — exists and enabled.
        const afterCreate = await host.callAccountActions('iam-user', 'read', { id });
        expect(afterCreate.ok).toBe(true);
        if (afterCreate.ok) expect(afterCreate.output).toEqual({ exists: true, enabled: true });

        // Disable — console access revoked.
        const disabled = await host.callAccountActions('iam-user', 'disable', { id });
        expect(disabled.ok).toBe(true);
        if (disabled.ok) expect(disabled.output.disabled).toBe(true);
        expect(await hasLoginProfile(userName)).toBe(false);

        // Read — still exists, now disabled.
        const afterDisable = await host.callAccountActions('iam-user', 'read', { id });
        expect(afterDisable.ok).toBe(true);
        if (afterDisable.ok) expect(afterDisable.output).toEqual({ exists: true, enabled: false });

        // Enable — console access restored and credentials re-sent via the email capability.
        const enabled = await host.callAccountActions('iam-user', 'enable', { id });
        expect(enabled.ok).toBe(true);
        if (enabled.ok) expect(enabled.output.enabled).toBe(true);
        expect(await hasLoginProfile(userName)).toBe(true);
        expect(host.hostFunctions.sentEmails.at(-1)?.subject).toBe('Your AWS access has been re-enabled');

        // Delete — user removed entirely.
        const deleted = await host.callAccountActions('iam-user', 'delete', { id });
        expect(deleted.ok).toBe(true);
        if (deleted.ok) expect(deleted.output.deleted).toBe(true);
        expect(await hasLoginProfile(userName)).toBe(false);

        // Read — no longer exists.
        const afterDelete = await host.callAccountActions('iam-user', 'read', { id });
        expect(afterDelete.ok).toBe(true);
        if (afterDelete.ok) expect(afterDelete.output).toEqual({ exists: false, enabled: false });
    });
});
