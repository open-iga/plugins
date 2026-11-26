import {
    CreateLoginProfileCommand,
    CreateUserCommand,
    EntityAlreadyExistsException,
    GetUserCommand,
    type IAMClient,
} from '@aws-sdk/client-iam';
import { sendEmail } from '@open-iga/connector-sdk';
import type awsConnector from '../aws-connector.ts';
import { USER_MANAGEMENT_ROLE } from '../utils/role-config.ts';
import { buildIamClient } from '../utils/client.ts';
import { IAM_ACTION_ENDPOINTS } from '../utils/aws-endpoints.ts';
import { generateTemporaryPassword } from '../utils/password.ts';
import { checkLoginProfileExists } from '../utils/iam.ts';
import { buildLoginUrl } from '../utils/arn.ts';
import { userNameFromEmail } from '../utils/username.ts';

// IAM has no email field, so the email is saved as a user tag.
const EMAIL_TAG = 'Email';

type CreateUserArgs = { iamClient: IAMClient; userName: string; email: string };

// Resolves undefined when the user name is already taken.
// https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateUser.html
const createUser = async ({ iamClient, userName, email }: CreateUserArgs) => {
    try {
        const { User } = await iamClient.send(
            new CreateUserCommand({ UserName: userName, Tags: [{ Key: EMAIL_TAG, Value: email }] }),
        );

        if (!User?.Arn) {
            throw new Error(`CreateUser returned no ARN for "${userName}"`);
        }

        return { arn: User.Arn };
    } catch (error) {
        if (error instanceof EntityAlreadyExistsException) {
            return undefined;
        }

        throw error;
    }
};

// Returns the ARN of an existing user, only when it has the same email and console access.
const getReusableUserArn = async ({ iamClient, userName, email }: CreateUserArgs): Promise<string> => {
    const { User } = await iamClient.send(new GetUserCommand({ UserName: userName }));
    const taggedEmail = User?.Tags?.find((tag) => tag.Key === EMAIL_TAG)?.Value;

    if (!User?.Arn || taggedEmail?.trim().toLowerCase() !== email.trim().toLowerCase()) {
        throw new Error(`IAM user "${userName}" already exists and is not tagged ${EMAIL_TAG}=${email}`);
    }

    // No login profile means disabled or half-created, so report failure instead of success.
    if (!(await checkLoginProfileExists(iamClient, userName))) {
        throw new Error(`IAM user "${userName}" exists without console access; enable or delete it first`);
    }

    return User.Arn;
};

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
            const iamClient = await buildIamClient({
                config,
                roleArn: config.AWS_USER_MANAGEMENT_ROLE,
                roleSessionName: 'openiga-aws-iam-user-create',
            });

            const userName = userNameFromEmail(input.email);
            const createdUser = await createUser({ iamClient, userName, email: input.email });

            if (!createdUser) {
                const existingArn = await getReusableUserArn({ iamClient, userName, email: input.email });

                return { accountId: existingArn, created: false };
            }

            // To grant the console access to user with a one-time password that must be changed after the first login
            const temporaryPassword = generateTemporaryPassword(config.AWS_PASSWORD_PATTERN);
            // https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateLoginProfile.html
            await iamClient.send(
                new CreateLoginProfileCommand({
                    UserName: userName,
                    Password: temporaryPassword,
                    PasswordResetRequired: true,
                }),
            );

            // Deliver credentials via the Host email capability so the password only travels
            // through that side channel — never through this action's return value. The Host
            // injects the recipient from the invocation input; the connector supplies data only and the Host renders the wording.
            const loginUrl = buildLoginUrl(createdUser.arn);
            sendEmail({
                template: 'credentials',
                reason: 'onboarded',
                system: 'AWS',
                loginUrl,
                username: userName,
                password: temporaryPassword,
                passwordChangeRequired: true,
            });

            return {
                accountId: createdUser.arn,
                created: true,
            };
        },
    });
};
