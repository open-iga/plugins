import * as z from 'zod/mini';

const metadataSchema = z.optional(z.record(z.string(), z.json()));

// Discovery returns the catalog of entitlements the host indexes for search / self-request.
// An entitlement is generic: a stable id, a human name, an optional description.
const discoverHandlerSchema = {
    input: z.object({}),
    output: z.object({
        entitlements: z.array(
            z.object({
                id: z.string(),
                name: z.string(),
                description: z.optional(z.string()),
                metadata: metadataSchema,
            }),
        ),
    }),
};

const grantHandlerSchema = {
    input: z.object({
        //  id returned by the account creation handler
        id: z.string(),
        // id returned by the entitlement discovery handler
        entitlementId: z.string(),
    }),
    output: z.object({
        granted: z.boolean(),
    }),
};

const revokeHandlerSchema = {
    input: z.object({
        //  id returned by the account creation handler
        id: z.string(),
        // id returned by the entitlement discovery handler
        entitlementId: z.string(),
    }),
    output: z.object({
        revoked: z.boolean(),
    }),
};

export const entitlementHandlerInputOutputSchema = {
    discover: discoverHandlerSchema,
    grant: grantHandlerSchema,
    revoke: revokeHandlerSchema,
};
