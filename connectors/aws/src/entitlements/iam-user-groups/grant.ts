import { AddUserToGroupCommand } from '@aws-sdk/client-iam';
import type awsConnector from '../../aws-connector.ts';
import { ENTITLEMENT_MANAGEMENT_ROLE } from '../../utils/role-config.ts';
import { buildIamClient } from '../../utils/client.ts';
import { IAM_ACTION_ENDPOINTS } from '../../utils/aws-endpoints.ts';
import { userNameFromArn, nameFromArn } from '../../utils/arn.ts';

export const registerIamUserGroupGrant = (plugin: typeof awsConnector) => {
    plugin.registerEntitlements('iam-user-group', {
        type: 'grant',
        description: 'Grant a user membership in an IAM user group',
        endpoints: IAM_ACTION_ENDPOINTS,
        config: [ENTITLEMENT_MANAGEMENT_ROLE],
        handler: async ({ config, input }) => {
            const iamClient = await buildIamClient({
                config,
                roleArn: config.AWS_ENTITLEMENT_MANAGEMENT_ROLE,
                roleSessionName: 'openiga-aws-iam-user-group-grant',
            });

            // https://docs.aws.amazon.com/IAM/latest/APIReference/API_AddUserToGroup.html
            await iamClient.send(
                new AddUserToGroupCommand({
                    UserName: userNameFromArn(input.accountId),
                    GroupName: nameFromArn(input.entitlementId),
                }),
            );

            return { granted: true };
        },
    });
};
