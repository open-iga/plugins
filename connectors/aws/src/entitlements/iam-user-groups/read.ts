import { paginateListGroupsForUser } from '@aws-sdk/client-iam';
import type awsConnector from '../../aws-connector.ts';
import { ENTITLEMENT_MANAGEMENT_ROLE } from '../../utils/role-config.ts';
import { buildIamClient } from '../../utils/client.ts';
import { IAM_ACTION_ENDPOINTS } from '../../utils/aws-endpoints.ts';
import { userNameFromArn } from '../../utils/arn.ts';

export const registerIamUserGroupsRead = (plugin: typeof awsConnector) => {
    plugin.registerEntitlements('iam-user-group', {
        type: 'read',
        description: 'Read the IAM user groups a user belongs to (for entitlement drift detection)',
        endpoints: IAM_ACTION_ENDPOINTS,
        config: [ENTITLEMENT_MANAGEMENT_ROLE],
        handler: async ({ config, input }) => {
            const iamClient = await buildIamClient({
                config,
                roleArn: config.AWS_ENTITLEMENT_MANAGEMENT_ROLE,
                roleSessionName: 'openiga-aws-iam-user-group-read',
            });

            // https://docs.aws.amazon.com/IAM/latest/APIReference/API_ListGroupsForUser.html
            const pages = paginateListGroupsForUser(
                { client: iamClient },
                { UserName: userNameFromArn(input.accountId) },
            );
            const entitlementIds: string[] = [];

            for await (const page of pages) {
                entitlementIds.push(...(page.Groups ?? []).map((group) => group.Arn!));
            }

            return { entitlementIds };
        },
    });
};
