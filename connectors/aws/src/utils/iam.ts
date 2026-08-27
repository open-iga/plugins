import { awsRequest, type AwsCredentials } from './client.ts';

// https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateUser.html
const IAM_API_VERSION = '2010-05-08';

// IAM is a global service reached at iam.amazonaws.com; SigV4 for it is always
// signed with us-east-1. Signing with the caller's region yields SignatureDoesNotMatch.
// https://docs.aws.amazon.com/general/latest/gr/iam-service.html
const IAM_SIGNING_REGION = 'us-east-1';

export interface CreateUserOptions {
    endpoint: string;
    credentials: AwsCredentials;
    userName: string;
}

export interface CreatedUser {
    userId: string;
    userName: string;
    arn: string;
}

export async function createUser({ endpoint, credentials, userName }: CreateUserOptions): Promise<CreatedUser> {
    const res = await awsRequest({
        endpoint: endpoint,
        region: IAM_SIGNING_REGION,
        service: 'iam',
        action: 'CreateUser',
        version: IAM_API_VERSION,
        credentials: credentials,
        params: { UserName: userName },
    });

    const arn = res.get('Arn');
    if (!arn) {
        throw new Error('CreateUser response missing user ARN');
    }

    return { userId: res.get('UserId'), userName: res.get('UserName'), arn };
}
