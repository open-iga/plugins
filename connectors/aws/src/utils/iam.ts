import { awsRequest, type AwsCredentials } from './client.ts';

// https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateUser.html
const IAM_API_VERSION = '2010-05-08';

export interface CreateUserOptions {
    endpoint: string;
    region: string;
    credentials: AwsCredentials;
    userName: string;
}

export interface CreatedUser {
    userId: string;
    userName: string;
    arn: string;
}

export async function createUser({ endpoint, credentials, region, userName }: CreateUserOptions): Promise<CreatedUser> {
    const res = await awsRequest({
        endpoint: endpoint,
        region: region,
        service: 'iam',
        action: 'CreateUser',
        version: IAM_API_VERSION,
        credentials: credentials,
        params: { UserName: userName },
    });

    const userId = res.get('UserId');
    if (!userId) {
        throw new Error('CreateUser response missing UserId');
    }

    return { userId, userName: res.get('UserName'), arn: res.get('Arn') };
}
