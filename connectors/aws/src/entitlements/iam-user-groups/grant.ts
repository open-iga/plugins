import type awsConnector from '../../aws-connector.ts';
import { assumeRole } from '../../utils/sts.ts';
import { IAM_ENDPOINT, stsEndpoint, IAM_ACTION_ENDPOINTS } from '../../utils/aws-endpoints.ts';
import { addUserToGroup } from '../../utils/iam.group.ts';
import { userNameFromArn, nameFromArn } from '../../utils/arn.ts';
import { resolveRegion } from '../../utils/region.ts';

export const registerEntitlementGrant = (plugin: typeof awsConnector) => {
    plugin.registerEntitlements('iam-user-group', {
        type: 'grant',
        description: 'Grant a user membership in an IAM user group',
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
                roleSessionName: 'openiga-aws-iam-user-group-grant',
            });

            await addUserToGroup({
                endpoint: IAM_ENDPOINT,
                credentials: assumed,
                userName: userNameFromArn(input.id),
                groupName: nameFromArn(input.entitlementId),
            });

            return { granted: true };
        },
    });
};
