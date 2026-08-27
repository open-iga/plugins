import type awsPlugin from '../aws-plugin.ts';
import { assumeRole } from '../utils/sts.ts';
import { createUser } from '../utils/iam.ts';

export const registerAccountActionCreation = (plugin: typeof awsPlugin) => {
    plugin.registerAccountActions('iam-user', {
        type: 'create',
        description: 'IAM User account creation',
        endpoints: [
            { method: 'POST', url: 'https://sts.{{AWS_REGION}}.amazonaws.com/', description: 'STS endpoint URL' },
            { method: 'POST', url: 'https://iam.amazonaws.com/', description: 'STS endpoint URL' },
        ],
        config: [
            {
                name: 'AWS_USER_CREATION_ROLE',
                description: 'ARN of the least-privilege role assumed (via STS) to create IAM users',
                required: true,
            },
        ],
        handler: async ({ config, input }) => {
            const region = config.AWS_REGION ?? 'us-east-1';

            const stsEndpoint = `https://sts.${region}.amazonaws.com`;
            const iamEndpoint = 'https://iam.amazonaws.com';

            const assumed = await assumeRole({
                endpoint: stsEndpoint,
                region,
                credentials: {
                    accessKeyId: config.AWS_ACCESS_KEY_ID,
                    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
                },
                roleArn: config.AWS_USER_CREATION_ROLE,
                roleSessionName: 'openiga-aws-iam-user-create',
            });

            const created = await createUser({
                endpoint: iamEndpoint,
                region,
                credentials: assumed,
                userName: input.email,
            });

            return {
                id: created.userId,
            };
        },
    });
};
