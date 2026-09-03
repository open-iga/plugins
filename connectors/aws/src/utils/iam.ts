import * as z from 'zod/mini';
import { awsRequest, type AwsCredentials } from './client.ts';

// https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateUser.html
const IAM_API_VERSION = '2010-05-08';

// Parsed CreateUser XML: arn is required (it is the account's stable id)
const createUserResponseSchema = z.object({
    CreateUserResponse: z.object({
        CreateUserResult: z.object({
            User: z.object({
                Arn: z.string().check(z.minLength(1, 'CreateUser response missing user ARN')),
                UserId: z.string(),
                UserName: z.string(),
            }),
        }),
    }),
});

// Parsed GetLoginProfile XML. PasswordResetRequired comes back as the string "true"/"false".
const getLoginProfileResponseSchema = z.object({
    GetLoginProfileResponse: z.object({
        GetLoginProfileResult: z.object({
            LoginProfile: z.object({
                UserName: z.string(),
                PasswordResetRequired: z.optional(z.string()),
            }),
        }),
    }),
});

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

export const createUser = async ({ endpoint, credentials, userName }: CreateUserOptions): Promise<CreatedUser> => {
    const { CreateUserResponse } = await awsRequest({
        endpoint: endpoint,
        region: IAM_SIGNING_REGION,
        service: 'iam',
        action: 'CreateUser',
        version: IAM_API_VERSION,
        credentials: credentials,
        params: { UserName: userName },
        schema: createUserResponseSchema,
    });

    const { Arn, UserId, UserName } = CreateUserResponse.CreateUserResult.User;
    return { userId: UserId, userName: UserName, arn: Arn };
};

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

export interface IamUserOptions {
    endpoint: string;
    credentials: AwsCredentials;
    userName: string;
}

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
