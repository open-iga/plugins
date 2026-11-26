import { afterEach, describe, expect, it } from 'bun:test';
import { awsConnector } from '../../aws-connector.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

const assumeRoleXml = `<AssumeRoleResponse><AssumeRoleResult><Credentials><AccessKeyId>ASIA</AccessKeyId><SecretAccessKey>secret</SecretAccessKey><SessionToken>token</SessionToken></Credentials></AssumeRoleResult></AssumeRoleResponse>`;

const buildListGroupsXml = (isTruncated: boolean) => {
    const marker = isTruncated ? '<Marker>next-page</Marker>' : '';

    return `<ListGroupsResponse><ListGroupsResult><IsTruncated>${isTruncated}</IsTruncated>${marker}<Groups><member><Arn>arn:aws:iam::1:group/a</Arn><GroupName>a</GroupName><Path>/</Path></member></Groups></ListGroupsResult></ListGroupsResponse>`;
};

const discoverGroups = async (isTruncated: boolean, cursor?: string) => {
    const requestBodies: string[] = [];
    globalThis.fetch = (async (_url: string, { body }: { body: string }) => {
        requestBodies.push(body);

        return new Response(body.includes('AssumeRole') ? assumeRoleXml : buildListGroupsXml(isTruncated));
    }) as never;

    const discover = awsConnector.entitlementRegistry.get('iam-user-group')!.get('discover')!;
    const output = await discover.handler({
        config: { AWS_REGION: 'us-east-1', AWS_ACCESS_KEY_ID: 'AKIA', AWS_SECRET_ACCESS_KEY: 'secret' },
        input: { tenant: { id: '1' }, cursor },
    } as never);

    return { output, requestBodies };
};

describe('discover', () => {
    it('should send the cursor and return the next one', async () => {
        const { output, requestBodies } = await discoverGroups(true, 'previous-page');

        expect(requestBodies.at(-1)).toContain('Marker=previous-page');
        expect(output).toEqual({
            entitlements: [{ entitlementId: 'arn:aws:iam::1:group/a', name: 'a' }],
            nextCursor: 'next-page',
        });
    });

    it('should omit the next cursor on the last page', async () => {
        const { output } = await discoverGroups(false);

        expect(output).not.toHaveProperty('nextCursor');
    });
});
