import * as z from 'zod/mini';
import { awsRequest, type AwsCredentials } from './client.ts';
import { IAM_API_VERSION, IAM_SIGNING_REGION, type IamUserOptions } from './iam.common.ts';

export interface IamGroup {
    arn: string;
    groupName: string;
    path: string;
}

const groupSchema = z.object({
    Arn: z.string().check(z.minLength(1, 'IAM group response missing group ARN')),
    GroupName: z.string(),
    Path: z.string(),
});

// fast-xml-parser collapses one <member> to an object, many to an array, and none to an empty
// string — normalize to an array before validating each group. Shared by ListGroups and
// ListGroupsForUser, which both nest the list under Groups.member.
const groupsField = z.pipe(
    z.transform((groups: unknown) => {
        const member = groups && typeof groups === 'object' ? (groups as { member?: unknown }).member : undefined;
        return Array.isArray(member) ? member : member ? [member] : [];
    }),
    z.array(groupSchema),
);

const toIamGroups = (groups: z.infer<typeof groupsField>): IamGroup[] =>
    groups.map((g) => ({ arn: g.Arn, groupName: g.GroupName, path: g.Path }));

const listGroupsResponseSchema = z.object({
    ListGroupsResponse: z.object({
        ListGroupsResult: z.object({
            IsTruncated: z.optional(z.string()),
            Marker: z.optional(z.string()),
            Groups: groupsField,
        }),
    }),
});

// https://docs.aws.amazon.com/IAM/latest/APIReference/API_ListGroups.html
export const listGroups = async ({
    endpoint,
    credentials,
}: Pick<IamUserOptions, 'endpoint' | 'credentials'>): Promise<IamGroup[]> => {
    const groups: IamGroup[] = [];
    let marker: string | undefined;

    do {
        const { ListGroupsResponse } = await awsRequest({
            endpoint,
            region: IAM_SIGNING_REGION,
            service: 'iam',
            action: 'ListGroups',
            version: IAM_API_VERSION,
            credentials,
            params: { Marker: marker },
            schema: listGroupsResponseSchema,
        });

        const { IsTruncated, Marker, Groups } = ListGroupsResponse.ListGroupsResult;
        groups.push(...toIamGroups(Groups));
        marker = IsTruncated === 'true' ? Marker : undefined;
    } while (marker);

    return groups;
};

const listGroupsForUserResponseSchema = z.object({
    ListGroupsForUserResponse: z.object({
        ListGroupsForUserResult: z.object({
            IsTruncated: z.optional(z.string()),
            Marker: z.optional(z.string()),
            Groups: groupsField,
        }),
    }),
});

// https://docs.aws.amazon.com/IAM/latest/APIReference/API_ListGroupsForUser.html
// The groups a user belongs to — the entitlement ids for drift detection. Paginated.
export const listGroupsAssignedToUser = async ({
    endpoint,
    credentials,
    userName,
}: IamUserOptions): Promise<IamGroup[]> => {
    const groups: IamGroup[] = [];
    let marker: string | undefined;

    do {
        const { ListGroupsForUserResponse } = await awsRequest({
            endpoint,
            region: IAM_SIGNING_REGION,
            service: 'iam',
            action: 'ListGroupsForUser',
            version: IAM_API_VERSION,
            credentials,
            params: { UserName: userName, Marker: marker },
            schema: listGroupsForUserResponseSchema,
        });

        const { IsTruncated, Marker, Groups } = ListGroupsForUserResponse.ListGroupsForUserResult;
        groups.push(...toIamGroups(Groups));
        marker = IsTruncated === 'true' ? Marker : undefined;
    } while (marker);

    return groups;
};

export interface UserGroupOptions extends IamUserOptions {
    groupName: string;
}

// https://docs.aws.amazon.com/IAM/latest/APIReference/API_AddUserToGroup.html
export const addUserToGroup = async ({
    endpoint,
    credentials,
    userName,
    groupName,
}: UserGroupOptions): Promise<void> => {
    await awsRequest({
        endpoint,
        region: IAM_SIGNING_REGION,
        service: 'iam',
        action: 'AddUserToGroup',
        version: IAM_API_VERSION,
        credentials,
        params: { GroupName: groupName, UserName: userName },
    });
};

// https://docs.aws.amazon.com/IAM/latest/APIReference/API_RemoveUserFromGroup.html
export const removeUserFromGroup = async ({
    endpoint,
    credentials,
    userName,
    groupName,
}: UserGroupOptions): Promise<void> => {
    await awsRequest({
        endpoint,
        region: IAM_SIGNING_REGION,
        service: 'iam',
        action: 'RemoveUserFromGroup',
        version: IAM_API_VERSION,
        credentials,
        params: { GroupName: groupName, UserName: userName },
    });
};

// https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateGroup.html
// Used to seed groups in tests; groups are provisioned out-of-band in production.
export const createGroup = async ({
    endpoint,
    credentials,
    groupName,
    path,
}: {
    endpoint: string;
    credentials: AwsCredentials;
    groupName: string;
    path?: string;
}): Promise<void> => {
    await awsRequest({
        endpoint,
        region: IAM_SIGNING_REGION,
        service: 'iam',
        action: 'CreateGroup',
        version: IAM_API_VERSION,
        credentials,
        params: { GroupName: groupName, Path: path },
    });
};
