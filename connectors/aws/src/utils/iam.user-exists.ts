import { awsRequest } from './client.ts';
import { IAM_API_VERSION, IAM_SIGNING_REGION, type IamUserOptions } from './iam.common.ts';

// https://docs.aws.amazon.com/IAM/latest/APIReference/API_GetUser.html
// Whether the IAM user exists. NoSuchEntity means it was deleted (or never created).
export const userExists = async ({ endpoint, credentials, userName }: IamUserOptions): Promise<boolean> => {
    try {
        await awsRequest({
            endpoint,
            region: IAM_SIGNING_REGION,
            service: 'iam',
            action: 'GetUser',
            version: IAM_API_VERSION,
            credentials,
            params: { UserName: userName },
        });
        return true;
    } catch (error) {
        if (String(error).includes('NoSuchEntity')) return false;
        throw error;
    }
};
