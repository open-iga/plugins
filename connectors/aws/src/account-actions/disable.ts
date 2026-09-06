import type awsConnector from '../aws-connector.ts';
import { assumeRole } from '../utils/sts.ts';
import { IAM_ENDPOINT, stsEndpoint, IAM_ACTION_ENDPOINTS } from '../utils/aws-endpoints.ts';
import { resolveRegion } from '../utils/region.ts';
import { deleteLoginProfile } from '../utils/iam.login-profile.ts';
import { userNameFromArn } from '../utils/arn.ts';

export const registerAccountActionDisable = (plugin: typeof awsConnector) => {
    plugin.registerAccountActions('iam-user', {
        type: 'disable',
        description: 'Disable an IAM user by revoking console access',
        endpoints: IAM_ACTION_ENDPOINTS,
        config: [
            {
                name: 'AWS_USER_MANAGEMENT_ROLE',
                description: 'ARN of the least-privilege role assumed (via STS) to manage IAM users',
                required: true,
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
                roleSessionName: 'openiga-aws-iam-user-disable',
            });

            const userName = userNameFromArn(input.id);

            try {
                await deleteLoginProfile({ endpoint: IAM_ENDPOINT, credentials: assumed, userName });
            } catch (error) {
                // No console access to begin with — already disabled, keep the action idempotent.
                if (!String(error).includes('NoSuchEntity')) throw error;
            }

            return { disabled: true };
        },
    });
};
