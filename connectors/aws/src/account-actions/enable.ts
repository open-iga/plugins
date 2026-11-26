import { sendEmail } from '@open-iga/connector-sdk';
import { CreateLoginProfileCommand } from '@aws-sdk/client-iam';
import type awsConnector from '../aws-connector.ts';
import { USER_MANAGEMENT_ROLE } from '../utils/role-config.ts';
import { buildIamClient } from '../utils/client.ts';
import { IAM_ACTION_ENDPOINTS } from '../utils/aws-endpoints.ts';
import { generateTemporaryPassword } from '../utils/password.ts';
import { accountIdFromArn, userNameFromArn } from '../utils/arn.ts';

export const registerAccountActionEnable = (plugin: typeof awsConnector) => {
    plugin.registerAccountActions('iam-user', {
        type: 'enable',
        description: 'Enable an IAM user by restoring console access',
        endpoints: IAM_ACTION_ENDPOINTS,
        config: [USER_MANAGEMENT_ROLE],
        handler: async ({ config, input }) => {
            const iamClient = await buildIamClient({
                config,
                roleArn: config.AWS_USER_MANAGEMENT_ROLE,
                roleSessionName: 'openiga-aws-iam-user-enable',
            });

            const userName = userNameFromArn(input.accountId);

            // Restore console access with a fresh one-time password the user must change at login.
            const temporaryPassword = generateTemporaryPassword();
            // https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateLoginProfile.html
            await iamClient.send(
                new CreateLoginProfileCommand({
                    UserName: userName,
                    Password: temporaryPassword,
                    PasswordResetRequired: true,
                }),
            );

            const loginUrl = `https://${accountIdFromArn(input.accountId)}.signin.aws.amazon.com/console`;
            sendEmail({
                template: 'credentials',
                reason: 'reenabled',
                system: 'AWS',
                loginUrl,
                username: userName,
                password: temporaryPassword,
                passwordChangeRequired: true,
            });

            return { enabled: true };
        },
    });
};
