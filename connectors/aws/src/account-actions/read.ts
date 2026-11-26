import type awsConnector from '../aws-connector.ts';
import { USER_MANAGEMENT_ROLE } from '../utils/role-config.ts';
import { buildIamClient } from '../utils/client.ts';
import { IAM_ACTION_ENDPOINTS } from '../utils/aws-endpoints.ts';
import { checkLoginProfileExists, checkUserExists } from '../utils/iam.ts';
import { userNameFromArn } from '../utils/arn.ts';

export const registerAccountActionRead = (plugin: typeof awsConnector) => {
    plugin.registerAccountActions('iam-user', {
        type: 'read',
        description: 'Read an IAM user account state for drift detection',
        endpoints: IAM_ACTION_ENDPOINTS,
        config: [USER_MANAGEMENT_ROLE],
        handler: async ({ config, input }) => {
            const iamClient = await buildIamClient({
                config,
                roleArn: config.AWS_USER_MANAGEMENT_ROLE,
                roleSessionName: 'openiga-aws-iam-user-read',
            });

            const userName = userNameFromArn(input.accountId);

            const exists = await checkUserExists(iamClient, userName);

            if (!exists) {
                return { exists: false, enabled: false };
            }

            const enabled = await checkLoginProfileExists(iamClient, userName);

            return { exists: true, enabled };
        },
    });
};
