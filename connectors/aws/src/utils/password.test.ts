import { generateTemporaryPassword } from './password.ts';

describe('generateTemporaryPassword', () => {
    it('should default to a 30-character password covering every class', () => {
        const password = generateTemporaryPassword();
        expect(password).toHaveLength(30);
        expect(password).toMatch(/[a-z]/);
        expect(password).toMatch(/[A-Z]/);
        expect(password).toMatch(/[0-9]/);
        expect(password).toMatch(/[!@#$%^&*()_+\-=[\]{}|]/);
    });

    it('should produce one character per pattern token', () => {
        expect(generateTemporaryPassword('Aa#@Aa#@')).toHaveLength(8);
    });

    it('should draw each position from the class its token names', () => {
        expect(generateTemporaryPassword('AAAAAAAA')).toMatch(/^[A-Z]{8}$/);
        expect(generateTemporaryPassword('aaaaaaaa')).toMatch(/^[a-z]{8}$/);
        expect(generateTemporaryPassword('########')).toMatch(/^[0-9]{8}$/);
        expect(generateTemporaryPassword('@@@@@@@@')).toMatch(/^[!@#$%^&*()_+\-=[\]{}|]{8}$/);
    });

    it('should reject a literal-only pattern that would repeat the same password every call', () => {
        expect(() => generateTemporaryPassword('PW-2024!!')).toThrow('only supports the tokens');
    });

    it('should reject characters AWS IAM does not accept', () => {
        expect(() => generateTemporaryPassword('Aa#@Aa#😀')).toThrow('only supports the tokens');
    });

    it('should reject a pattern shorter than the minimum length', () => {
        expect(() => generateTemporaryPassword('Aa#@Aa#')).toThrow('8-128 characters');
    });

    it('should reject a pattern longer than the maximum length', () => {
        expect(() => generateTemporaryPassword('a'.repeat(129))).toThrow('8-128 characters');
    });

    it('should accept the boundary lengths of 8 and 128', () => {
        expect(generateTemporaryPassword('a'.repeat(8))).toHaveLength(8);
        expect(generateTemporaryPassword('a'.repeat(128))).toHaveLength(128);
    });

    it('should produce a different value on each call', () => {
        expect(generateTemporaryPassword()).not.toBe(generateTemporaryPassword());
    });
});
