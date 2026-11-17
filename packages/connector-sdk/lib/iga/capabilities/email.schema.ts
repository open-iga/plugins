import * as z from 'zod/mini';

// Email is a Host capability: the Host owns routing + transport (recipient, from-address,
// SMTP/SES connection, auth, retries, deliverability, audit).
//
// A connector supplies structured data only, never free-form text. The Host renders the
// subject and body from a fixed plain-text template, so a connector can't write its own copy
// (e.g. "verify your account") and use the trusted sender for phishing. The recipient is also
// not part of the payload: the Host injects it from the invocation input.
//
// The Host must run this same schema on receipt, the connector-side parse is not a trust boundary.
export const emailPayloadSchema = z.object({
    template: z.literal('credentials'),
    reason: z.enum(['onboarded', 'reenabled']),
    // Human-readable name of the target system, e.g. "AWS"
    system: z.string().check(z.minLength(1), z.maxLength(64), z.regex(/^[^\r\n]*$/)),
    loginUrl: z.url({ protocol: /^https$/ }).check(z.maxLength(2048)),
    username: z.string().check(z.minLength(1), z.maxLength(256), z.regex(/^[^\r\n]*$/)),
    password: z.string().check(z.minLength(1), z.maxLength(256), z.regex(/^[^\r\n]*$/)),
    // Tell the user they must set a new password at first sign-in (not every system supports it)
    passwordChangeRequired: z.boolean(),
});

export type EmailPayload = z.infer<typeof emailPayloadSchema>;
