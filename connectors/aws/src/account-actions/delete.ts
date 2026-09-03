import type awsConnector from '../aws-connector.ts';
import { assumeRole } from '../utils/sts.ts';
import { resolveRegion } from '../utils/region.ts';
import { deleteLoginProfile, deleteUser } from '../utils/iam.ts';
import { userNameFromArn } from '../utils/arn.ts';

export const registerAccountActionDelete = (plugin: typeof awsConnector) => {
    plugin.registerAccountActions('iam-user', {
        type: 'delete',
        description: 'Delete an IAM user',
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
        // TODO: cleanup after introducing entitlements. The user must have no attached login profile, access keys or other dependencies first, otherwise AWS returns DeleteConflict.
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
                roleSessionName: 'openiga-aws-iam-user-delete',
            });

            const userName = userNameFromArn(input.id);

            // DeleteUser fails if a login profile still exists — remove it first (best-effort).
            try {
                await deleteLoginProfile({ endpoint: iamEndpoint, credentials: assumed, userName });
            } catch (error) {
                if (!String(error).includes('NoSuchEntity')) throw error;
            }

            await deleteUser({ endpoint: iamEndpoint, credentials: assumed, userName });

            return { deleted: true };
        },
    });
};
