import * as z from 'zod/mini';
import { awsRequest } from './client.ts';
import { IAM_API_VERSION, IAM_SIGNING_REGION, type IamUserOptions } from './iam.common.ts';

const tagSchema = z.object({ Key: z.string(), Value: z.string() });

// fast-xml-parser yields an object for one <member>, an array for many, and '' for an empty <Tags/>
const getUserResponseSchema = z.object({
    GetUserResponse: z.object({
        GetUserResult: z.object({
            User: z.object({
                Arn: z.string(),
                Tags: z.optional(
                    z.union([z.literal(''), z.object({ member: z.union([tagSchema, z.array(tagSchema)]) })]),
                ),
            }),
        }),
    }),
});

// https://docs.aws.amazon.com/IAM/latest/APIReference/API_GetUser.html
export const getUser = async ({
    endpoint,
    credentials,
    userName,
}: IamUserOptions): Promise<{ arn: string; tags: Record<string, string> }> => {
    const { GetUserResponse } = await awsRequest({
        endpoint,
        region: IAM_SIGNING_REGION,
        service: 'iam',
        action: 'GetUser',
        version: IAM_API_VERSION,
        credentials,
        params: { UserName: userName },
        schema: getUserResponseSchema,
    });

    const { Arn, Tags } = GetUserResponse.GetUserResult.User;
    const members = !Tags ? [] : [Tags.member].flat();
    return { arn: Arn, tags: Object.fromEntries(members.map(({ Key, Value }) => [Key, Value])) };
};
