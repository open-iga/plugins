import type awsConnector from '../../aws-connector.ts';
import { assumeRole } from '../../utils/sts.ts';
import { IAM_ENDPOINT, stsEndpoint, IAM_ACTION_ENDPOINTS } from '../../utils/aws-endpoints.ts';
import { listGroups } from '../../utils/iam.group.ts';
import { resolveRegion } from '../../utils/region.ts';

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

export const registerEntitlementDiscover = (plugin: typeof awsConnector) => {
    plugin.registerEntitlements('iam-user-group', {
        type: 'discover',
        description: 'Discover assignable IAM user groups for the entitlement catalog',
        endpoints: IAM_ACTION_ENDPOINTS,
        config: [
            {
                name: 'AWS_GROUP_DISCOVERY_ROLE',
                description: 'ARN of the least-privilege role assumed (via STS) to list IAM user groups',
                required: true,
            },
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
        handler: async ({ config }) => {
            const region = resolveRegion(config.AWS_REGION);

            const excludePatterns = parseExcludePatterns(config.AWS_GROUP_EXCLUDE_PATTERNS);

            const assumed = await assumeRole({
                endpoint: stsEndpoint(region),
                region,
                credentials: {
                    accessKeyId: config.AWS_ACCESS_KEY_ID,
                    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
                },
                roleArn: config.AWS_GROUP_DISCOVERY_ROLE,
                roleSessionName: 'openiga-aws-iam-user-group-discover',
            });

            const groups = await listGroups({ endpoint: IAM_ENDPOINT, credentials: assumed });

            const catalog = groups.filter(
                (group) => !excludePatterns.some((pattern) => pattern.test(group.groupName) || pattern.test(group.path)),
            );

            return {
                entitlements: catalog.map((group) => ({
                    entitlementId: group.arn,
                    name: group.groupName,
                })),
            };
        },
    });
};
