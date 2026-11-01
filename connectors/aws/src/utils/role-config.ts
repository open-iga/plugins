// Each role below is assumed by the base access key via STS. The descriptions state the exact
// permissions so an operator (or an LLM) can write a least-privilege policy for each role.
// Resource scopes follow the IAM action table: https://docs.aws.amazon.com/service-authorization/latest/reference/list_awsidentityandaccessmanagementiam.html
const TRUST = [
    'Trust policy: one Allow statement with Action "sts:AssumeRole" and Principal {"AWS": "<base-user-arn>"},',
    'where <base-user-arn> is the ARN of the IAM user that owns AWS_ACCESS_KEY_ID.',
    'Do not use the account root as the Principal. The role must be in the same AWS account as that user.',
    'The user then needs no sts:AssumeRole permission of its own.',
].join(' ');

export const USER_MANAGEMENT_ROLE = {
    name: 'AWS_USER_MANAGEMENT_ROLE',
    description: [
        'ARN of the IAM role assumed to manage IAM users. ' + TRUST,
        'Allow only: iam:CreateUser, iam:TagUser, iam:GetUser, iam:CreateLoginProfile, iam:GetLoginProfile, iam:DeleteLoginProfile, iam:DeleteUser.',
        'Resource: arn:aws:iam::<account-id>:user/* (the connector creates users without a path, so they sit at the root).',
    ].join(' '),
    required: true,
} as const;

export const GROUP_DISCOVERY_ROLE = {
    name: 'AWS_GROUP_DISCOVERY_ROLE',
    description: [
        'ARN of the IAM role assumed to list assignable IAM groups. ' + TRUST,
        'Allow only: iam:ListGroups. Resource must be "*" because IAM has no resource-level permission for ListGroups.',
    ].join(' '),
    required: true,
} as const;

export const ENTITLEMENT_MANAGEMENT_ROLE = {
    name: 'AWS_ENTITLEMENT_MANAGEMENT_ROLE',
    description: [
        'ARN of the IAM role assumed to manage IAM group membership. ' + TRUST,
        'Allow only: iam:AddUserToGroup, iam:RemoveUserFromGroup, iam:ListGroupsForUser.',
        'Resource: for AddUserToGroup and RemoveUserFromGroup, the assignable groups (arn:aws:iam::<account-id>:group/<path-prefix>*); for ListGroupsForUser, the managed users (arn:aws:iam::<account-id>:user/*).',
    ].join(' '),
    required: true,
} as const;
