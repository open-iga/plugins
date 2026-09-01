import { userNameFromEmail } from './username.ts';

describe('userNameFromEmail', () => {
    it('should use the local part of the email', () => {
        expect(userNameFromEmail('fff.ggg@gmail.com')).toBe('fff.ggg');
    });

    it('should lowercase the local part so the same address maps to one username', () => {
        expect(userNameFromEmail('John.Smith@Example.com')).toBe('john.smith');
    });

    it('should trim surrounding whitespace before deriving the username', () => {
        expect(userNameFromEmail('  fff.ggg@gmail.com  ')).toBe('fff.ggg');
    });

    it('should preserve IAM-allowed characters in the local part', () => {
        expect(userNameFromEmail('a_b+c-d.e=f@example.com')).toBe('a_b+c-d.e=f');
    });

    it('should replace characters outside the IAM set with a hyphen', () => {
        expect(userNameFromEmail('foo%bar@example.com')).toBe('foo-bar');
    });

    it('should throw when the local part is empty', () => {
        expect(() => userNameFromEmail('@example.com')).toThrow('Cannot derive an IAM-valid username');
    });

    it('should throw when the local part exceeds 64 characters', () => {
        const longLocal = 'a'.repeat(65);
        expect(() => userNameFromEmail(`${longLocal}@example.com`)).toThrow('Cannot derive an IAM-valid username');
    });

    it('should accept a local part of exactly 64 characters', () => {
        const localPart = 'a'.repeat(64);
        expect(userNameFromEmail(`${localPart}@example.com`)).toBe(localPart);
    });
});
