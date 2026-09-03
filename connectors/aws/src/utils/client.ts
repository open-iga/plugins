import { AwsClient } from 'aws4fetch';
import { XMLParser } from 'fast-xml-parser';

export interface AwsCredentials {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
}

export interface AwsRequestOptions<T = unknown> {
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
    // Optional schema the caller supplies to validate and shape the parsed response.
    schema?: ResponseSchema<T>;
}

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false });

/**
 * Parse an AWS Query-protocol XML response into a plain JS object (QuickJS has no DOMParser).
 * Values are kept as strings (parseTagValue: false) so ids/tokens/dates aren't coerced to numbers;
 * attributes are ignored — AWS Query responses carry their data in element text. Callers hand the
 * result to a zod schema that both validates and shapes the fields they need.
 */
export const parseXml = (xml: string): unknown => parser.parse(xml);

// The caller passes any schema exposing a `parse` (e.g. a zod schema); the client stays
// decoupled from the validator and simply returns its validated output.
export interface ResponseSchema<T> {
    parse(input: unknown): T;
}

/**
 * Make a signed AWS Query-protocol request — build the form body, SigV4-sign, POST, and parse the XML response.
 *
 * AWS Query protocol common parameters: https://docs.aws.amazon.com/IAM/latest/APIReference/CommonParameters.html
 * SigV4: https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html
 * Smithy: https://smithy.io/2.0/aws/protocols/aws-query-protocol.html
 */
export const awsRequest = async <T = unknown>({
    endpoint,
    action,
    credentials,
    params,
    region,
    service,
    version,
    schema,
}: AwsRequestOptions<T>): Promise<T> => {
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
        const error = (doc as { ErrorResponse?: { Error?: { Code?: string; Message?: string } } })?.ErrorResponse
            ?.Error;
        const detail = [error?.Code, error?.Message].filter(Boolean).join(' ');
        throw new Error(`${action} failed (${res.status}): ${detail || text}`);
    }

    // With no schema the response body is discarded; the schema both validates and shapes it.
    return schema ? schema.parse(doc) : (doc as T);
};
