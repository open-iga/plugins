import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createMockedHost, type MockedHost } from '@open-iga/connector-sdk/test';
import { awsConnector } from '../src/aws-connector.ts';
import { createGroup } from '../src/utils/iam.group.ts';

const endpoint = () => process.env.AWS_ENDPOINT_URL ?? '';
const credentials = { accessKeyId: 'test', secretAccessKey: 'test' };

describe('entitlements', () => {
    let host: MockedHost;

    beforeAll(async () => {
        host = await createMockedHost({
            plugin: awsConnector,
            config: {
                AWS_REGION: 'us-east-1',
                AWS_ACCESS_KEY_ID: 'test',
                AWS_SECRET_ACCESS_KEY: 'test',
                AWS_USER_MANAGEMENT_ROLE: 'arn:aws:iam::000000000000:role/openiga-user-management',
                AWS_GROUP_DISCOVERY_ROLE: 'arn:aws:iam::000000000000:role/openiga-group-discovery',
                // Operator filter for internal groups (';'-separated regex; matched against name or path).
                AWS_GROUP_EXCLUDE_PATTERNS: '^ci-;^temp-',
                AWS_ENTITLEMENT_MANAGEMENT_ROLE: 'arn:aws:iam::000000000000:role/openiga-entitlement-management',
            },
            mockUpstream: endpoint(),
        });

        // Seed assignable groups plus one internal group excluded by the operator regex.
        await createGroup({ endpoint: endpoint(), credentials, groupName: 'ReadOnly', path: '/' });
        await createGroup({ endpoint: endpoint(), credentials, groupName: 'Admins', path: '/' });
        await createGroup({ endpoint: endpoint(), credentials, groupName: 'ci-deployer', path: '/' });
    });

    afterAll(async () => {
        await host.close();
    });

    it('should discover user groups, excluding operator-filtered ones', async () => {
        const result = await host.callEntitlements('iam-user-group', 'discover');
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const names = result.output.entitlements.map((e) => e.name);
        expect(names).toContain('ReadOnly');
        expect(names).toContain('Admins');
        // Excluded by the operator regex config.
        expect(names).not.toContain('ci-deployer'); // ^ci-

        // Each entitlement's id is the group ARN.
        const readOnly = result.output.entitlements.find((e) => e.name === 'ReadOnly');
        expect(readOnly?.entitlementId).toContain(':group/ReadOnly');
    });

    it('should grant, read, and revoke a group membership for a user', async () => {
        // A user to receive the entitlement.
        const created = await host.callAccountActions('iam-user', 'create', {
            email: 'grant.target@openiga.dev',
            firstname: 'grant',
            lastname: 'target',
        });
        expect(created.ok).toBe(true);
        if (!created.ok) return;
        const userArn = created.output.id;

        // Discover to get a real group ARN to grant.
        const discovered = await host.callEntitlements('iam-user-group', 'discover');
        expect(discovered.ok).toBe(true);
        if (!discovered.ok) return;
        const groupArn = discovered.output.entitlements.find((e) => e.name === 'ReadOnly')!.entitlementId;

        // Grant — the user is added to the group.
        const granted = await host.callEntitlements('iam-user-group', 'grant', {
            id: userArn,
            entitlementId: groupArn,
        });
        expect(granted.ok).toBe(true);
        if (granted.ok) expect(granted.output.granted).toBe(true);

        // Read (drift detection) — the group ARN is reported back.
        const readGranted = await host.callEntitlements('iam-user-group', 'read', { id: userArn });
        expect(readGranted.ok).toBe(true);
        if (readGranted.ok) expect(readGranted.output.entitlementIds).toContain(groupArn);

        // Revoke — the user is removed from the group.
        const revoked = await host.callEntitlements('iam-user-group', 'revoke', {
            id: userArn,
            entitlementId: groupArn,
        });
        expect(revoked.ok).toBe(true);
        if (revoked.ok) expect(revoked.output.revoked).toBe(true);

        // Read after revoke — no longer reported.
        const readRevoked = await host.callEntitlements('iam-user-group', 'read', { id: userArn });
        expect(readRevoked.ok).toBe(true);
        if (readRevoked.ok) expect(readRevoked.output.entitlementIds).not.toContain(groupArn);
    });
});
