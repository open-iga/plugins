import { resolveRegion } from './region.ts';

describe('resolveRegion', () => {
    it('should return a well-formed region unchanged', () => {
        expect(resolveRegion('us-east-1')).toBe('us-east-1');
    });

    it('should accept multi-segment regions', () => {
        expect(resolveRegion('ap-southeast-2')).toBe('ap-southeast-2');
        expect(resolveRegion('us-gov-west-1')).toBe('us-gov-west-1');
        expect(resolveRegion('cn-north-1')).toBe('cn-north-1');
    });

    it('should fall back to the default region when undefined', () => {
        expect(resolveRegion(undefined)).toBe('us-east-1');
    });

    it('should reject a region containing a path separator', () => {
        expect(() => resolveRegion('us-east-1/../evil.com')).toThrow('Invalid AWS_REGION');
    });

    it('should reject a region containing an at sign', () => {
        expect(() => resolveRegion('evil.com@us-east-1')).toThrow('Invalid AWS_REGION');
    });

    it('should reject a region containing extra dots', () => {
        expect(() => resolveRegion('us-east-1.evil.com')).toThrow('Invalid AWS_REGION');
    });

    it('should reject an empty region', () => {
        expect(() => resolveRegion('')).toThrow('Invalid AWS_REGION');
    });

    it('should reject a region without a trailing number', () => {
        expect(() => resolveRegion('us-east')).toThrow('Invalid AWS_REGION');
    });

    it('should reject an uppercase region', () => {
        expect(() => resolveRegion('US-EAST-1')).toThrow('Invalid AWS_REGION');
    });
});
