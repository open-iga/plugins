import { awsRequest, type AwsCredentials } from './client.ts';

// https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html
const STS_API_VERSION = '2011-06-15';

export interface AssumeRoleOptions {
    endpoint: string;
    region: string;
    credentials: AwsCredentials;
    roleArn: string;
    roleSessionName: string;
    durationSeconds?: number;
}

export interface AssumedRole {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    expiration: string;
}

export async function assumeRole({
    endpoint,
    credentials,
    durationSeconds,
    region,
    roleArn,
    roleSessionName,
}: AssumeRoleOptions): Promise<AssumedRole> {
    const res = await awsRequest({
        endpoint,
        region,
        service: 'sts',
        action: 'AssumeRole',
        version: STS_API_VERSION,
        credentials,
        params: {
            RoleArn: roleArn,
            RoleSessionName: roleSessionName,
            DurationSeconds: durationSeconds,
        },
    });

    const accessKeyId = res.get('AccessKeyId');
    const secretAccessKey = res.get('SecretAccessKey');
    const sessionToken = res.get('SessionToken');
    if (!accessKeyId || !secretAccessKey || !sessionToken) {
        throw new Error('AssumeRole response missing credentials');
    }

    return { accessKeyId, secretAccessKey, sessionToken, expiration: res.get('Expiration') };
}
