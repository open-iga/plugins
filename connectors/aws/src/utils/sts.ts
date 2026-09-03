import * as z from 'zod/mini';
import { awsRequest, type AwsCredentials } from './client.ts';

// https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html
const STS_API_VERSION = '2011-06-15';

const assumeRoleResponseSchema = z.object({
    AssumeRoleResponse: z.object({
        AssumeRoleResult: z.object({
            Credentials: z.object({
                AccessKeyId: z.string().check(z.minLength(1, 'AssumeRole response missing AccessKeyId')),
                SecretAccessKey: z.string().check(z.minLength(1, 'AssumeRole response missing SecretAccessKey')),
                SessionToken: z.string().check(z.minLength(1, 'AssumeRole response missing SessionToken')),
                Expiration: z.optional(z.string()),
            }),
        }),
    }),
});

export interface AssumeRoleOptions {
    endpoint: string;
    region: string;
    credentials: AwsCredentials;
    roleArn: string;
    roleSessionName: string;
    durationSeconds?: number;
}

export interface AssumedRole {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    expiration: string;
}

export const assumeRole = async ({
    endpoint,
    credentials,
    durationSeconds,
    region,
    roleArn,
    roleSessionName,
}: AssumeRoleOptions): Promise<AssumedRole> => {
    const { AssumeRoleResponse } = await awsRequest({
        endpoint,
        region,
        service: 'sts',
        action: 'AssumeRole',
        version: STS_API_VERSION,
        credentials,
        params: {
            RoleArn: roleArn,
            RoleSessionName: roleSessionName,
            DurationSeconds: durationSeconds,
        },
        schema: assumeRoleResponseSchema,
    });

    const { AccessKeyId, SecretAccessKey, SessionToken, Expiration } = AssumeRoleResponse.AssumeRoleResult.Credentials;

    return {
        accessKeyId: AccessKeyId,
        secretAccessKey: SecretAccessKey,
        sessionToken: SessionToken,
        expiration: Expiration ?? '',
    };
};
