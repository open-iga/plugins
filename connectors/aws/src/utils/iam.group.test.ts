import { afterEach, describe, expect, it } from 'bun:test';
import { listGroups } from './iam.group.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

const credentials = { accessKeyId: 'AKIA', secretAccessKey: 'secret' };

const respond = (truncated: boolean) => {
    const marker = truncated ? '<Marker>next-page</Marker>' : '';
    return new Response(
        `<ListGroupsResponse><ListGroupsResult><IsTruncated>${truncated}</IsTruncated>${marker}<Groups><member><Arn>arn:aws:iam::1:group/a</Arn><GroupName>a</GroupName><Path>/</Path></member></Groups></ListGroupsResult></ListGroupsResponse>`,
    );
};

describe('listGroups', () => {
    it('should return one page with its marker and send the given marker', async () => {
        let body = '';
        globalThis.fetch = (async (_url: unknown, init: { body: string }) => {
            body = init.body;
            return respond(true);
        }) as never;

        const page = await listGroups({ endpoint: 'https://iam.amazonaws.com', credentials, marker: 'prev' });

        expect(body).toContain('Marker=prev');
        expect(page.groups.map((g) => g.groupName)).toEqual(['a']);
        expect(page.nextMarker).toBe('next-page');
    });

    it('should omit nextMarker on the last page', async () => {
        globalThis.fetch = (async () => respond(false)) as never;

        const page = await listGroups({ endpoint: 'https://iam.amazonaws.com', credentials });

        expect(page.nextMarker).toBeUndefined();
    });
});
