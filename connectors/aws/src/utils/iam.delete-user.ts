import { awsRequest } from './client.ts';
import { IAM_API_VERSION, IAM_SIGNING_REGION, type IamUserOptions } from './iam.common.ts';

// https://docs.aws.amazon.com/IAM/latest/APIReference/API_DeleteUser.html
export const deleteUser = async ({ endpoint, credentials, userName }: IamUserOptions): Promise<void> => {
    await awsRequest({
        endpoint,
        region: IAM_SIGNING_REGION,
        service: 'iam',
        action: 'DeleteUser',
        version: IAM_API_VERSION,
        credentials,
        params: { UserName: userName },
    });
};
