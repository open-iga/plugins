import * as z from 'zod/mini';
import { emailPayloadSchema, type EmailPayload } from './email.schema.ts';

/**
 * Send an email through the Host's `sendEmail` capability.
 *
 * - Host owns routing + transport (recipient, from-address, SMTP/SES connection, auth, retries, deliverability, audit)
 * - A connector supplies only structured data (see email.schema.ts); the Host renders the wording from a fixed template, so the same capability is reused across every connector without it being a phishing channel
 * - The recipient (`to`) is deliberately NOT part of this payload: the Host already knows the target identity's address from the invocation input and injects it. That prevents a
 * connector from redirecting credentials to an arbitrary address.
 *
 * Delivery success/failure is handled by Host, it categorizes and reports errors. The connector just hands over the content and frees the memory it allocated.
 */
export const sendEmail = (payload: EmailPayload): void => {
    const parsed = z.parse(emailPayloadSchema, payload);

    const mem = Memory.fromString(JSON.stringify(parsed));
    try {
        Host.getFunctions().sendEmail(mem.offset);
    } finally {
        mem.free();
    }
};
