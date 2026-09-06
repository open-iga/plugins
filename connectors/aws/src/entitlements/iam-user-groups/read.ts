import type awsConnector from '../../aws-connector.ts';
import { assumeRole } from '../../utils/sts.ts';
import { IAM_ENDPOINT, stsEndpoint, IAM_ACTION_ENDPOINTS } from '../../utils/aws-endpoints.ts';
import { listGroupsAssignedToUser } from '../../utils/iam.group.ts';
import { userNameFromArn } from '../../utils/arn.ts';
import { resolveRegion } from '../../utils/region.ts';

export const registerEntitlementRead = (plugin: typeof awsConnector) => {
    plugin.registerEntitlements('iam-user-group', {
        type: 'read',
        description: 'Read the IAM user groups a user belongs to (for entitlement drift detection)',
        endpoints: IAM_ACTION_ENDPOINTS,
        config: [
            {
                name: 'AWS_ENTITLEMENT_MANAGEMENT_ROLE',
                description: 'ARN of the least-privilege role assumed (via STS) to manage user group membership',
                required: true,
            },
        ],
        handler: async ({ config, input }) => {
            const region = resolveRegion(config.AWS_REGION);

            const assumed = await assumeRole({
                endpoint: stsEndpoint(region),
                region,
                credentials: {
                    accessKeyId: config.AWS_ACCESS_KEY_ID,
                    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
                },
                roleArn: config.AWS_ENTITLEMENT_MANAGEMENT_ROLE,
                roleSessionName: 'openiga-aws-iam-user-group-read',
            });

            const groups = await listGroupsAssignedToUser({
                endpoint: IAM_ENDPOINT,
                credentials: assumed,
                userName: userNameFromArn(input.id),
            });

            return { entitlementIds: groups.map((group) => group.arn) };
        },
    });
};
