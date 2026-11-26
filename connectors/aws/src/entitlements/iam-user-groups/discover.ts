import { ListGroupsCommand } from '@aws-sdk/client-iam';
import type awsConnector from '../../aws-connector.ts';
import { GROUP_DISCOVERY_ROLE } from '../../utils/role-config.ts';
import { buildIamClient } from '../../utils/client.ts';
import { IAM_ACTION_ENDPOINTS } from '../../utils/aws-endpoints.ts';

// Parse ';' separated patterns into RegEx
const parseExcludePatterns = (raw: string | null): RegExp[] => {
    if (!raw) return [];

    return raw
        .split(';')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((entry) => {
            try {
                return new RegExp(entry);
            } catch {
                throw new Error(`AWS_GROUP_EXCLUDE_PATTERNS contains an invalid regex: ${entry}`);
            }
        });
};

export const registerIamUserGroupsDiscover = (plugin: typeof awsConnector) => {
    plugin.registerEntitlements('iam-user-group', {
        type: 'discover',
        description: 'Discover assignable IAM user groups for the entitlement catalog',
        endpoints: IAM_ACTION_ENDPOINTS,
        config: [
            GROUP_DISCOVERY_ROLE,
            {
                name: 'AWS_GROUP_EXCLUDE_PATTERNS',
                description: `
                ';'-separated list of regex patterns to filter out internal groups; a group is excluded
                if any pattern matches its name or path (e.g. "^ci-;/infra/").
                `
                    .replace(/\s+/g, ' ')
                    .trim(),
                required: false,
            },
        ],
        handler: async ({ config, input }) => {
            const excludePatterns = parseExcludePatterns(config.AWS_GROUP_EXCLUDE_PATTERNS);

            const iamClient = await buildIamClient({
                config,
                roleArn: config.AWS_GROUP_DISCOVERY_ROLE,
                roleSessionName: 'openiga-aws-iam-user-group-discover',
            });

            // The AWS marker is the cursor: one page per call.
            // https://docs.aws.amazon.com/IAM/latest/APIReference/API_ListGroups.html
            const { Groups, IsTruncated, Marker } = await iamClient.send(
                new ListGroupsCommand({ Marker: input.cursor }),
            );

            const catalog = (Groups ?? []).filter(
                (group) =>
                    !excludePatterns.some(
                        (pattern) => pattern.test(group.GroupName ?? '') || pattern.test(group.Path ?? ''),
                    ),
            );

            return {
                entitlements: catalog.map(({ Arn, GroupName }) => ({
                    entitlementId: Arn!,
                    name: GroupName ?? 'MISSING_GROUP_NAME',
                })),
                ...(IsTruncated && Marker ? { nextCursor: Marker } : {}),
            };
        },
    });
};
