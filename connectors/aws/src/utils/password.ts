// Generate a temporary console password. Entropy comes from WebCrypto's getRandomValues, which
// the runtime provides; Math.random must not be used for credentials. At length 30 over this
// alphabet the chance of missing any character class is negligible, so no class enforcement.
// IAM password policy: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_passwords_account-policy.html
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|';

export const generateTemporaryPassword = (length = 30): string => {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
};
