import { GetLoginProfileCommand, GetUserCommand, NoSuchEntityException, type IAMClient } from '@aws-sdk/client-iam';

// Resolves false when the target of the request does not exist.
export const checkTargetExists = async (request: Promise<unknown>): Promise<boolean> => {
    try {
        await request;

        return true;
    } catch (error) {
        if (error instanceof NoSuchEntityException) {
            return false;
        }

        throw error;
    }
};

// https://docs.aws.amazon.com/IAM/latest/APIReference/API_GetUser.html
export const checkUserExists = (iamClient: IAMClient, userName: string): Promise<boolean> =>
    checkTargetExists(iamClient.send(new GetUserCommand({ UserName: userName })));

// A user without a login profile has no console access.
// https://docs.aws.amazon.com/IAM/latest/APIReference/API_GetLoginProfile.html
export const checkLoginProfileExists = (iamClient: IAMClient, userName: string): Promise<boolean> =>
    checkTargetExists(iamClient.send(new GetLoginProfileCommand({ UserName: userName })));
