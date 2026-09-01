// IAM UserName contract: 1–64 chars, each in [\w+=,.@-].
// https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateUser.html
const IAM_USERNAME_MAX_LENGTH = 64;
const IAM_DISALLOWED_CHARS = /[^\w+=,.@-]/g;

export const userNameFromEmail = (email: string): string => {
    // Use the email's local part (before `@`) as the username for stable and human-readable part
    // This is opinionated; change this if required in the figure
    const localPart = email.trim().toLowerCase().split('@')[0] ?? '';
    const userName = localPart.replace(IAM_DISALLOWED_CHARS, '-');

    if (userName.length === 0 || userName.length > IAM_USERNAME_MAX_LENGTH) {
        throw new Error(
            `Cannot derive an IAM-valid username from email "${email}": must be 1–${IAM_USERNAME_MAX_LENGTH} characters in [\\w+=,.@-] after sanitization.`,
        );
    }

    return userName;
};
