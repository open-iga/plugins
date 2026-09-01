// Region shape: lowercase groups joined by hyphens, ending in a number, e.g. us-east-1,
// ap-southeast-2, us-gov-west-1, cn-north-1.
// AWS_REGION is interpolated into the STS endpoint (`https://sts.<region>.amazonaws.com`) that
// awsRequest then signs and fetches. If it is not constrained, a value carrying `/`, `@`, `#`,
// or extra dots can repoint the signed request at an attacker-controlled host, leaking the
// derived credentials. Validate it against the AWS region shape before it reaches the endpoint.
// https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html
const AWS_REGION_PATTERN = /^[a-z]{2}(-[a-z]+)+-\d+$/;

const DEFAULT_REGION = 'us-east-1';

export const resolveRegion = (region: string | undefined): string => {
    const value = region ?? DEFAULT_REGION;

    if (!AWS_REGION_PATTERN.test(value)) {
        throw new Error(`Invalid AWS_REGION "${value}": expected an AWS region such as "${DEFAULT_REGION}".`);
    }

    return value;
};
