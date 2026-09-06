import type awsConnector from '../aws-connector.ts';
import { assumeRole } from '../utils/sts.ts';
import { IAM_ENDPOINT, stsEndpoint, IAM_ACTION_ENDPOINTS } from '../utils/aws-endpoints.ts';
import { resolveRegion } from '../utils/region.ts';
import { deleteLoginProfile } from '../utils/iam.login-profile.ts';
import { deleteUser } from '../utils/iam.delete-user.ts';
import { userNameFromArn } from '../utils/arn.ts';

export const registerAccountActionDelete = (plugin: typeof awsConnector) => {
    plugin.registerAccountActions('iam-user', {
        type: 'delete',
        description: 'Delete an IAM user',
        endpoints: IAM_ACTION_ENDPOINTS,
        config: [
            {
                name: 'AWS_USER_MANAGEMENT_ROLE',
                description: 'ARN of the least-privilege role assumed (via STS) to manage IAM users',
                required: true,
            },
        ],
        // TODO: cleanup after introducing entitlements. The user must have no attached login profile, access keys or other dependencies first, otherwise AWS returns DeleteConflict.
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
                roleSessionName: 'openiga-aws-iam-user-delete',
            });

            const userName = userNameFromArn(input.id);

            // DeleteUser fails if a login profile still exists — remove it first (best-effort).
            try {
                await deleteLoginProfile({ endpoint: IAM_ENDPOINT, credentials: assumed, userName });
            } catch (error) {
                if (!String(error).includes('NoSuchEntity')) throw error;
            }

            await deleteUser({ endpoint: IAM_ENDPOINT, credentials: assumed, userName });

            return { deleted: true };
        },
    });
};
