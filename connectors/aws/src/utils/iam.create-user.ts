import * as z from 'zod/mini';
import { awsRequest, type AwsCredentials } from './client.ts';
import { IAM_API_VERSION, IAM_SIGNING_REGION } from './iam.common.ts';

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

// https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateUser.html
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
