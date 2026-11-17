import { sendEmail } from '@open-iga/connector-sdk';
import type awsConnector from '../aws-connector.ts';
import { USER_MANAGEMENT_ROLE } from '../utils/role-config.ts';
import { assumeRole } from '../utils/sts.ts';
import { IAM_ENDPOINT, stsEndpoint, IAM_ACTION_ENDPOINTS } from '../utils/aws-endpoints.ts';
import { resolveRegion } from '../utils/region.ts';
import { createLoginProfile } from '../utils/iam.login-profile.ts';
import { generateTemporaryPassword } from '../utils/password.ts';
import { accountIdFromArn, userNameFromArn } from '../utils/arn.ts';

export const registerAccountActionEnable = (plugin: typeof awsConnector) => {
    plugin.registerAccountActions('iam-user', {
        type: 'enable',
        description: 'Enable an IAM user by restoring console access',
        endpoints: IAM_ACTION_ENDPOINTS,
        config: [USER_MANAGEMENT_ROLE],
        handler: async ({ config, input }) => {
            const region = resolveRegion(config.AWS_REGION);

            const assumed = await assumeRole({
                endpoint: stsEndpoint(region),
                region,
                credentials: {
                    accessKeyId: config.AWS_ACCESS_KEY_ID,
                    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
                },
                roleArn: config.AWS_USER_MANAGEMENT_ROLE,
                roleSessionName: 'openiga-aws-iam-user-enable',
            });

            const userName = userNameFromArn(input.accountId);

            // Restore console access with a fresh one-time password the user must change at login.
            const temporaryPassword = generateTemporaryPassword();
            await createLoginProfile({
                endpoint: IAM_ENDPOINT,
                credentials: assumed,
                userName,
                password: temporaryPassword,
            });

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
