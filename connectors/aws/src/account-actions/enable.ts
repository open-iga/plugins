import { sendEmail } from '@open-iga/connector-sdk';
import type awsConnector from '../aws-connector.ts';
import { assumeRole } from '../utils/sts.ts';
import { resolveRegion } from '../utils/region.ts';
import { createLoginProfile } from '../utils/iam.ts';
import { generateTemporaryPassword } from '../utils/password.ts';
import { accountIdFromArn, userNameFromArn } from '../utils/arn.ts';

export const registerAccountActionEnable = (plugin: typeof awsConnector) => {
    plugin.registerAccountActions('iam-user', {
        type: 'enable',
        description: 'Enable an IAM user by restoring console access',
        endpoints: [
            { method: 'POST', url: 'https://sts.{{AWS_REGION}}.amazonaws.com/', description: 'STS endpoint URL' },
            { method: 'POST', url: 'https://iam.amazonaws.com/', description: 'IAM endpoint URL' },
        ],
        config: [
            {
                name: 'AWS_USER_MANAGEMENT_ROLE',
                description: 'ARN of the least-privilege role assumed (via STS) to manage IAM users',
                required: true,
            },
        ],
        handler: async ({ config, input }) => {
            const region = resolveRegion(config.AWS_REGION);

            const stsEndpoint = `https://sts.${region}.amazonaws.com`;
            const iamEndpoint = 'https://iam.amazonaws.com';

            const assumed = await assumeRole({
                endpoint: stsEndpoint,
                region,
                credentials: {
                    accessKeyId: config.AWS_ACCESS_KEY_ID,
                    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
                },
                roleArn: config.AWS_USER_MANAGEMENT_ROLE,
                roleSessionName: 'openiga-aws-iam-user-enable',
            });

            const userName = userNameFromArn(input.id);

            // Restore console access with a fresh one-time password the user must change at login.
            const temporaryPassword = generateTemporaryPassword();
            await createLoginProfile({
                endpoint: iamEndpoint,
                credentials: assumed,
                userName,
                password: temporaryPassword,
            });

            const loginUrl = `https://${accountIdFromArn(input.id)}.signin.aws.amazon.com/console`;
            sendEmail({
                subject: 'Your AWS access has been re-enabled',
                body: [
                    'Hi,',
                    '',
                    'Your AWS access has been re-enabled. You will be asked to set a new password at first sign-in.',
                    `AWS Login URL: ${loginUrl}`,
                    `Username: ${userName}`,
                    `Password: ${temporaryPassword}`,
                ].join('\n'),
            });

            return { enabled: true };
        },
    });
};
