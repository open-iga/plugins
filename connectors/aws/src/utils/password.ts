const charClasses: Record<string, string> = {
    A: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    a: 'abcdefghijklmnopqrstuvwxyz',
    '#': '0123456789',
    '@': '!@#$%^&*()_+-=[]{}|',
};

const DEFAULT_PATTERN = 'Aa#@'.repeat(8).slice(0, 30);

// IAM password policy: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_passwords_account-policy.html
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

export const generateTemporaryPassword = (pattern?: string | null): string => {
    const template = pattern ?? DEFAULT_PATTERN;

    if (template.length < MIN_LENGTH || template.length > MAX_LENGTH) {
        throw new Error(`Password pattern must yield ${MIN_LENGTH}-${MAX_LENGTH} characters, got ${template.length}.`);
    }

    const bytes = new Uint8Array(template.length);
    crypto.getRandomValues(bytes);
    return Array.from(template, (token, i) => {
        const charClass = charClasses[token];
        return charClass ? charClass.charAt(bytes[i]! % charClass.length) : token;
    }).join('');
};
