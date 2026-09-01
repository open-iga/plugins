import { AwsClient } from 'aws4fetch';
import { parseXml, findValue } from './xml.ts';

export interface AwsCredentials {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
}

export interface AwsRequestOptions {
    endpoint: string;
    region: string;
    service: 'sts' | 'iam';
    action:
        | 'AssumeRole'
        | 'CreateUser'
        | 'CreateLoginProfile'
        | 'GetLoginProfile'
        | 'GetUser'
        | 'DeleteLoginProfile'
        | 'DeleteUser';
    version: string; // service API version that pins the request/response contract
    credentials: AwsCredentials;
    // Action-specific params; undefined/empty values are omitted from the request.
    params?: Record<string, string | number | undefined>;
}

export interface AwsResponse {
    doc: unknown;
    // Text of the first element named `tag` anywhere in the response ('' if absent).
    get(tag: string): string;
}

/**
 * Make a signed AWS Query-protocol request — build the form body, SigV4-sign, POST, and parse the XML response.
 *
 * AWS Query protocol common parameters: https://docs.aws.amazon.com/IAM/latest/APIReference/CommonParameters.html
 * SigV4: https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html
 * Smithy: https://smithy.io/2.0/aws/protocols/aws-query-protocol.html
 */
export const awsRequest = async ({
    endpoint,
    action,
    credentials,
    params,
    region,
    service,
    version,
}: AwsRequestOptions): Promise<AwsResponse> => {
    const urlSearchParams = new URLSearchParams({ Action: action, Version: version });
    for (const [key, value] of Object.entries(params ?? {})) {
        if (value !== undefined && value !== '') urlSearchParams.set(key, String(value));
    }
    const body = urlSearchParams.toString();

    // aws4fetch adds x-amz-security-token automatically when a session token is present.
    const aws = new AwsClient({
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        ...(credentials.sessionToken ? { sessionToken: credentials.sessionToken } : {}),
        service,
        region,
    });

    const signed = await aws.sign(`${endpoint}/`, {
        method: 'POST',
        body,
        headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
    });

    // Extism `fetch` takes (url, init), not a Request instance — re-issue it.
    const headers: Record<string, string> = {};
    signed.headers.forEach((value, key) => (headers[key] = value));

    const res = await fetch(signed.url, { method: signed.method, headers, body });
    const text = await res.text();
    const doc = parseXml(text);

    if (!res.ok) {
        // AWS Query errors: <ErrorResponse><Error><Code>…</Code><Message>…</Message>.
        const detail = [findValue(doc, 'Code'), findValue(doc, 'Message')].filter(Boolean).join(' ');
        throw new Error(`${action} failed (${res.status}): ${detail || text}`);
    }

    return { doc, get: (tag) => findValue(doc, tag) };
};
