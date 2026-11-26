// IAM ARN shape: arn:aws:iam::<accountId>:user/<userName>
// The account actions receive the ARN as the stable `accountId`, so both the account id and the username are derived from it.
const accountIdFromArn = (arn: string): string => arn.split(':')[4] ?? '';

// https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_sign-in.html
export const buildLoginUrl = (arn: string): string => `https://${accountIdFromArn(arn)}.signin.aws.amazon.com/console`;

export const userNameFromArn = (arn: string): string => arn.split('/').pop() ?? '';

// Last path segment of an IAM ARN — the resource name. Works for group ARNs
// (arn:aws:iam::<accountId>:group[/path]/<groupName>) and any other name-suffixed IAM ARN.
export const nameFromArn = (arn: string): string => arn.split('/').pop() ?? '';
