import { DeleteLoginProfileCommand, DeleteUserCommand } from '@aws-sdk/client-iam';
import type awsConnector from '../aws-connector.ts';
import { USER_MANAGEMENT_ROLE } from '../utils/role-config.ts';
import { buildIamClient } from '../utils/client.ts';
import { IAM_ACTION_ENDPOINTS } from '../utils/aws-endpoints.ts';
import { checkTargetExists } from '../utils/iam.ts';
import { userNameFromArn } from '../utils/arn.ts';

export const registerAccountActionDelete = (plugin: typeof awsConnector) => {
    plugin.registerAccountActions('iam-user', {
        type: 'delete',
        description: 'Delete an IAM user',
        endpoints: IAM_ACTION_ENDPOINTS,
        config: [USER_MANAGEMENT_ROLE],
        handler: async ({ config, input }) => {
            const iamClient = await buildIamClient({
                config,
                roleArn: config.AWS_USER_MANAGEMENT_ROLE,
                roleSessionName: 'openiga-aws-iam-user-delete',
            });

            const userName = userNameFromArn(input.accountId);

            // DeleteUser fails while a login profile exists, so remove that first
            // In an ideal world this wouldn't happen; this was introduced as part of CodeRabbit findings and it makes sense for a real world scenario
            // (e.g.) User email is changed before the onboarding; so the IT can delete the email and onboard a new email
            // https://docs.aws.amazon.com/IAM/latest/APIReference/API_DeleteUser.html
            await checkTargetExists(iamClient.send(new DeleteLoginProfileCommand({ UserName: userName })));
            await iamClient.send(new DeleteUserCommand({ UserName: userName }));

            return { deleted: true };
        },
    });
};
