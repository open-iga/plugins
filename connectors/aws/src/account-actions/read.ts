import type awsConnector from '../aws-connector.ts';
import { assumeRole } from '../utils/sts.ts';
import { IAM_ENDPOINT, stsEndpoint, IAM_ACTION_ENDPOINTS } from '../utils/aws-endpoints.ts';
import { resolveRegion } from '../utils/region.ts';
import { userExists } from '../utils/iam.user-exists.ts';
import { hasLoginProfile } from '../utils/iam.login-profile.ts';
import { userNameFromArn } from '../utils/arn.ts';

export const registerAccountActionRead = (plugin: typeof awsConnector) => {
    plugin.registerAccountActions('iam-user', {
        type: 'read',
        description: 'Read an IAM user account state for drift detection',
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
                roleSessionName: 'openiga-aws-iam-user-read',
            });

            const userName = userNameFromArn(input.id);

            const exists = await userExists({ endpoint: IAM_ENDPOINT, credentials: assumed, userName });
            if (!exists) {
                return { exists: false, enabled: false };
            }

            // Enabled = the user still has console access (a login profile).
            const enabled = await hasLoginProfile({ endpoint: IAM_ENDPOINT, credentials: assumed, userName });

            return { exists: true, enabled };
        },
    });
};
