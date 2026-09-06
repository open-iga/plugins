// IAM ARN shape: arn:aws:iam::<accountId>:user/<userName>
// The account actions receive the ARN as the stable `id`, so both the account id and the username are derived from it.
export const accountIdFromArn = (arn: string): string => arn.split(':')[4] ?? '';

export const userNameFromArn = (arn: string): string => arn.split('/').pop() ?? '';

// Last path segment of an IAM ARN — the resource name. Works for group ARNs
// (arn:aws:iam::<accountId>:group[/path]/<groupName>) and any other name-suffixed IAM ARN.
export const nameFromArn = (arn: string): string => arn.split('/').pop() ?? '';
