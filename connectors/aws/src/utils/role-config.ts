// Each role below is assumed by the base access key via STS. The descriptions state the exact
// permissions so an operator (or an LLM) can write a least-privilege policy for each role.
const TRUST =
    'Trust policy: allow sts:AssumeRole from the principal that owns AWS_ACCESS_KEY_ID. That principal also needs sts:AssumeRole on this role ARN.';

export const USER_MANAGEMENT_ROLE = {
    name: 'AWS_USER_MANAGEMENT_ROLE',
    description: [
        'ARN of the IAM role assumed to manage IAM users. ' + TRUST,
        'Allow only: iam:CreateUser, iam:TagUser, iam:GetUser, iam:CreateLoginProfile, iam:GetLoginProfile, iam:DeleteLoginProfile, iam:DeleteUser.',
        'Resource: arn:aws:iam::<account-id>:user/<path-prefix>* (limit to the path prefix of managed users).',
    ].join(' '),
    required: true,
} as const;

export const GROUP_DISCOVERY_ROLE = {
    name: 'AWS_GROUP_DISCOVERY_ROLE',
    description: [
        'ARN of the IAM role assumed to list assignable IAM groups. ' + TRUST,
        'Allow only: iam:ListGroups. Resource: arn:aws:iam::<account-id>:group/<path-prefix>*.',
    ].join(' '),
    required: true,
} as const;

export const ENTITLEMENT_MANAGEMENT_ROLE = {
    name: 'AWS_ENTITLEMENT_MANAGEMENT_ROLE',
    description: [
        'ARN of the IAM role assumed to manage IAM group membership. ' + TRUST,
        'Allow only: iam:AddUserToGroup, iam:RemoveUserFromGroup, iam:ListGroupsForUser.',
        'Resource: the managed users (arn:aws:iam::<account-id>:user/<path-prefix>*) and the assignable groups (arn:aws:iam::<account-id>:group/<path-prefix>*).',
    ].join(' '),
    required: true,
} as const;
