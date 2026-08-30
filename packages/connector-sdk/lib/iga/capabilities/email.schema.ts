import * as z from 'zod/mini';

// Email is a Host capability: the Host owns routing + transport (recipient, from-address,
// SMTP/SES connection, auth, retries, deliverability, audit). A connector supplies only the
// content, so the same capability is reused across every connector.
//
// The recipient (`to`) is deliberately NOT part of this payload: the Host already knows the
// target identity's address from the invocation input and injects it itself. That prevents a
// connector from redirecting credentials to an arbitrary address.
export const emailPayloadSchema = z.object({
    subject: z.string().check(z.minLength(1)),
    body: z.string().check(z.minLength(1)),
});

export type EmailPayload = z.infer<typeof emailPayloadSchema>;
