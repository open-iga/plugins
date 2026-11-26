import { DeleteLoginProfileCommand } from '@aws-sdk/client-iam';
import type awsConnector from '../aws-connector.ts';
import { USER_MANAGEMENT_ROLE } from '../utils/role-config.ts';
import { buildIamClient } from '../utils/client.ts';
import { IAM_ACTION_ENDPOINTS } from '../utils/aws-endpoints.ts';
import { checkTargetExists } from '../utils/iam.ts';
import { userNameFromArn } from '../utils/arn.ts';

export const registerAccountActionDisable = (plugin: typeof awsConnector) => {
    plugin.registerAccountActions('iam-user', {
        type: 'disable',
        description: 'Disable an IAM user by revoking console access',
        endpoints: IAM_ACTION_ENDPOINTS,
        config: [USER_MANAGEMENT_ROLE],
        handler: async ({ config, input }) => {
            const iamClient = await buildIamClient({
                config,
                roleArn: config.AWS_USER_MANAGEMENT_ROLE,
                roleSessionName: 'openiga-aws-iam-user-disable',
            });

            const userName = userNameFromArn(input.accountId);

            // A missing login profile means the user is already disabled.
            // https://docs.aws.amazon.com/IAM/latest/APIReference/API_DeleteLoginProfile.html
            await checkTargetExists(iamClient.send(new DeleteLoginProfileCommand({ UserName: userName })));

            return { disabled: true };
        },
    });
};
