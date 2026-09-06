import * as z from 'zod/mini';
import { awsRequest, type AwsCredentials } from './client.ts';
import { IAM_API_VERSION, IAM_SIGNING_REGION, type IamUserOptions } from './iam.common.ts';

const getLoginProfileResponseSchema = z.object({
    GetLoginProfileResponse: z.object({
        GetLoginProfileResult: z.object({
            LoginProfile: z.object({
                UserName: z.string(),
                // PasswordResetRequired comes back as the string "true"/"false"
                PasswordResetRequired: z.optional(z.string()),
            }),
        }),
    }),
});

export interface CreateLoginProfileOptions {
    endpoint: string;
    credentials: AwsCredentials;
    userName: string;
    password: string;
}

// https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateLoginProfile.html
export const createLoginProfile = async ({
    endpoint,
    credentials,
    userName,
    password,
}: CreateLoginProfileOptions): Promise<void> => {
    await awsRequest({
        endpoint,
        region: IAM_SIGNING_REGION,
        service: 'iam',
        action: 'CreateLoginProfile',
        version: IAM_API_VERSION,
        credentials,
        params: {
            UserName: userName,
            Password: password,
            // Force the user to pick their own password at first console sign-in.
            PasswordResetRequired: 'true',
        },
    });
};

export interface GetLoginProfileOptions {
    endpoint: string;
    credentials: AwsCredentials;
    userName: string;
}

export interface LoginProfile {
    userName: string;
    passwordResetRequired: boolean;
}

// https://docs.aws.amazon.com/IAM/latest/APIReference/API_GetLoginProfile.html
export const getLoginProfile = async ({
    endpoint,
    credentials,
    userName,
}: GetLoginProfileOptions): Promise<LoginProfile> => {
    const { GetLoginProfileResponse } = await awsRequest({
        endpoint,
        region: IAM_SIGNING_REGION,
        service: 'iam',
        action: 'GetLoginProfile',
        version: IAM_API_VERSION,
        credentials,
        params: { UserName: userName },
        schema: getLoginProfileResponseSchema,
    });

    const { UserName, PasswordResetRequired } = GetLoginProfileResponse.GetLoginProfileResult.LoginProfile;
    return {
        userName: UserName,
        passwordResetRequired: PasswordResetRequired === 'true',
    };
};

// Whether the user currently has console access (a login profile). Absence = disabled.
export const hasLoginProfile = async (options: IamUserOptions): Promise<boolean> => {
    try {
        await getLoginProfile(options);
        return true;
    } catch (error) {
        if (String(error).includes('NoSuchEntity')) return false;
        throw error;
    }
};

// https://docs.aws.amazon.com/IAM/latest/APIReference/API_DeleteLoginProfile.html
// Removes the user's console password, revoking sign-in without deleting the user.
export const deleteLoginProfile = async ({ endpoint, credentials, userName }: IamUserOptions): Promise<void> => {
    await awsRequest({
        endpoint,
        region: IAM_SIGNING_REGION,
        service: 'iam',
        action: 'DeleteLoginProfile',
        version: IAM_API_VERSION,
        credentials,
        params: { UserName: userName },
    });
};
