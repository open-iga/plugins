import type { AwsCredentials } from './client.ts';

// https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateUser.html
export const IAM_API_VERSION = '2010-05-08';

// https://docs.aws.amazon.com/general/latest/gr/iam-service.html
export const IAM_SIGNING_REGION = 'us-east-1';

export interface IamUserOptions {
    endpoint: string;
    credentials: AwsCredentials;
    userName: string;
}
