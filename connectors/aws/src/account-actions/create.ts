import { sendEmail } from '@open-iga/connector-sdk';
import type awsConnector from '../aws-connector.ts';
import { USER_MANAGEMENT_ROLE } from '../utils/role-config.ts';
import { assumeRole } from '../utils/sts.ts';
import { IAM_ENDPOINT, stsEndpoint, IAM_ACTION_ENDPOINTS } from '../utils/aws-endpoints.ts';
import { resolveRegion } from '../utils/region.ts';
import { createUser, EMAIL_TAG } from '../utils/iam.create-user.ts';
import { getUser } from '../utils/iam.get-user.ts';
import { createLoginProfile } from '../utils/iam.login-profile.ts';
import { generateTemporaryPassword } from '../utils/password.ts';
import { userNameFromEmail } from '../utils/username.ts';

// ARN shape: arn:aws:iam::<accountId>:user/<name>. The console sign-in URL is account-scoped.
const accountIdFromArn = (arn: string): string => arn.split(':')[4] ?? '';

export const registerAccountActionCreation = (plugin: typeof awsConnector) => {
    plugin.registerAccountActions('iam-user', {
        type: 'create',
        description: 'IAM User account creation',
        endpoints: IAM_ACTION_ENDPOINTS,
        config: [
            USER_MANAGEMENT_ROLE,
            {
                name: 'AWS_PASSWORD_PATTERN',
                description:
                    'Template for the temporary password: A=uppercase, a=lowercase, #=digit, @=symbol, other chars are literal (e.g.) AAa#@ would result two uppercase, one lowercase, a digit and a symbol. Defaults to a 30-character mix of all classes.',
                required: false,
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
                roleArn: config.AWS_USER_MANAGEMENT_ROLE,
                roleSessionName: 'openiga-aws-iam-user-create',
            });

            const userName = userNameFromEmail(input.email);
            let created;
            try {
                created = await createUser({
                    endpoint: IAM_ENDPOINT,
                    credentials: assumed,
                    userName,
                    email: input.email,
                });
            } catch (error) {
                if (!String(error).includes('EntityAlreadyExists')) throw error;

                // Reuse the existing user only if its Email tag matches; the username is just the email's first part.
                const existing = await getUser({ endpoint: IAM_ENDPOINT, credentials: assumed, userName });
                if (existing.tags[EMAIL_TAG]?.toLowerCase() !== input.email.trim().toLowerCase()) {
                    throw new Error(
                        `IAM user "${userName}" already exists and is not tagged ${EMAIL_TAG}=${input.email}`,
                    );
                }
                return { id: existing.arn, created: false };
            }

            // To grant the console access to user with a one-time password that must be changed after the first login
            const temporaryPassword = generateTemporaryPassword(config.AWS_PASSWORD_PATTERN);
            await createLoginProfile({
                endpoint: IAM_ENDPOINT,
                credentials: assumed,
                userName: created.userName,
                password: temporaryPassword,
            });

            // TODO: there is a possibility the plugin could do a phishing attack; check for alternative options
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
                created: true,
            };
        },
    });
};
