import { generateTemporaryPassword } from './password.ts';

// Mirrors the generator's alphabet so we can assert every character is in-set.
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|';

describe('generateTemporaryPassword', () => {
    it('should default to a length of 30', () => {
        expect(generateTemporaryPassword()).toHaveLength(30);
    });

    it('should honour a requested length', () => {
        expect(generateTemporaryPassword(12)).toHaveLength(12);
    });

    it('should return an empty string for length 0', () => {
        expect(generateTemporaryPassword(0)).toBe('');
    });

    it('should only use characters from the allowed alphabet', () => {
        const password = generateTemporaryPassword(500);
        for (const char of password) {
            expect(ALPHABET).toContain(char);
        }
    });

    it('should produce a different value on each call', () => {
        expect(generateTemporaryPassword()).not.toBe(generateTemporaryPassword());
    });
});
