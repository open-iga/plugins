import * as z from 'zod/mini';
import { connectorConfigSchema } from './connector.config.schema.ts';

// Build-time validation schema for an entitlement operation (parallel to an account action).
export const connectorEntitlementSchema = z.object({
    type: z.enum(['discover', 'grant', 'revoke']),
    description: z.string(),
    endpoints: z.array(
        z.object({
            method: z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']),
            // If the endpoint depends on the config, template placeholders can be used (e.g.) https://site.{{ REGION }}.domain.com
            url: z
                .string()
                .check(
                    z.regex(/^https?:\/\//, 'Upstream URL must start with http:// or https:// (allow-listed by Host)'),
                ),
            description: z.string().check(z.minLength(1)),
        }),
    ),
    config: z.optional(connectorConfigSchema),
    handler: z.custom<(...args: unknown[]) => unknown>(
        (input) => typeof input === 'function',
        'handler must be a function',
    ),
});

export type ConnectorEntitlement = z.infer<typeof connectorEntitlementSchema>;
