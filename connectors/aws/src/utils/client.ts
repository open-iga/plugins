import { IAMClient } from '@aws-sdk/client-iam';
import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import { requestHandler } from './request-handler.ts';
import { resolveRegion } from './region.ts';

// IAM is global and signs against this region: https://docs.aws.amazon.com/general/latest/gr/iam-service.html
const IAM_SIGNING_REGION = 'us-east-1';

// One attempt only: the wasm runtime has no timers for retry backoff.
const CLIENT_DEFAULTS = { requestHandler, maxAttempts: 1 };

type BuildIamClientArgs = {
    config: { AWS_REGION: string; AWS_ACCESS_KEY_ID: string; AWS_SECRET_ACCESS_KEY: string };
    roleArn: string;
    roleSessionName: string;
};

// https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html
export const buildIamClient = async ({ config, roleArn, roleSessionName }: BuildIamClientArgs): Promise<IAMClient> => {
    const stsClient = new STSClient({
        ...CLIENT_DEFAULTS,
        region: resolveRegion(config.AWS_REGION),
        credentials: { accessKeyId: config.AWS_ACCESS_KEY_ID, secretAccessKey: config.AWS_SECRET_ACCESS_KEY },
    });

    const { Credentials } = await stsClient.send(
        new AssumeRoleCommand({ RoleArn: roleArn, RoleSessionName: roleSessionName }),
    );

    if (!Credentials?.AccessKeyId || !Credentials.SecretAccessKey || !Credentials.SessionToken) {
        throw new Error(`AssumeRole returned no credentials for ${roleArn}`);
    }

    return new IAMClient({
        ...CLIENT_DEFAULTS,
        region: IAM_SIGNING_REGION,
        credentials: {
            accessKeyId: Credentials.AccessKeyId,
            secretAccessKey: Credentials.SecretAccessKey,
            sessionToken: Credentials.SessionToken,
        },
    });
};
