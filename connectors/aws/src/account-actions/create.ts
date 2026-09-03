import { sendEmail } from '@open-iga/connector-sdk';
import type awsConnector from '../aws-connector.ts';
import { assumeRole } from '../utils/sts.ts';
import { resolveRegion } from '../utils/region.ts';
import { createUser, createLoginProfile } from '../utils/iam.ts';
import { generateTemporaryPassword } from '../utils/password.ts';
import { userNameFromEmail } from '../utils/username.ts';

// ARN shape: arn:aws:iam::<accountId>:user/<name>. The console sign-in URL is account-scoped.
const accountIdFromArn = (arn: string): string => arn.split(':')[4] ?? '';

export const registerAccountActionCreation = (plugin: typeof awsConnector) => {
    plugin.registerAccountActions('iam-user', {
        type: 'create',
        description: 'IAM User account creation',
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
            {
                name: 'AWS_PASSWORD_PATTERN',
                description:
                    'Template for the temporary password: A=uppercase, a=lowercase, #=digit, @=symbol, other chars are literal (e.g.) AAa#@ would result two uppercase, one lowercase, a digit and a symbol. Defaults to a 30-character mix of all classes.',
                required: false,
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
                roleSessionName: 'openiga-aws-iam-user-create',
            });

            const created = await createUser({
                endpoint: iamEndpoint,
                credentials: assumed,
                userName: userNameFromEmail(input.email),
            });

            // To grant the console access to user with a one-time password that must be changed after the first login
            const temporaryPassword = generateTemporaryPassword(config.AWS_PASSWORD_PATTERN);
            await createLoginProfile({
                endpoint: iamEndpoint,
                credentials: assumed,
                userName: created.userName,
                password: temporaryPassword,
            });

            // Deliver credentials via the Host email capability so the password only travels
            // through that side channel — never through this action's return value. The Host
            // injects the recipient from the invocation input; the connector supplies content only.
            const loginUrl = `https://${accountIdFromArn(created.arn)}.signin.aws.amazon.com/console`;
            sendEmail({
                subject: 'Your AWS access',
                body: [
                    `Hi ${input.firstname} ${input.lastname},`,
                    '',
                    'Here is your AWS access. You will be asked to set a new password at first sign-in.',
                    `AWS Login URL: ${loginUrl}`,
                    `Username: ${created.userName}`,
                    `Password: ${temporaryPassword}`,
                ].join('\n'),
            });

            return {
                id: created.arn,
            };
        },
    });
};
