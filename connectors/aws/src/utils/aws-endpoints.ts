export const IAM_ENDPOINT = 'https://iam.amazonaws.com';

export const stsEndpoint = (region: string): string => `https://sts.${region}.amazonaws.com`;

type Endpoint = { method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; url: string; description: string };

// Manifest endpoint allow-list shared by every IAM action/entitlement: STS to assume a role,
// IAM to act. {{AWS_REGION}} is host-interpolated at runtime.
export const IAM_ACTION_ENDPOINTS: Endpoint[] = [
    { method: 'POST', url: 'https://sts.{{AWS_REGION}}.amazonaws.com/', description: 'STS endpoint URL' },
    { method: 'POST', url: 'https://iam.amazonaws.com/', description: 'IAM endpoint URL' },
];
