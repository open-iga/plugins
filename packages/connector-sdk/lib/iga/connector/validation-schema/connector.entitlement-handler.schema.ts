import * as z from 'zod/mini';
import { tenantSchema } from './connector.tenant.schema.ts';

const metadataSchema = z.optional(z.record(z.string(), z.json()));

// Discovery returns the catalog of entitlements the host indexes for search / self-request.
// An entitlement is generic: a stable id, a human name, an optional description. The catalog is
// paged: keep calling with `nextCursor` until it is missing.
const discoverHandlerSchema = {
    input: z.object({ tenant: tenantSchema, cursor: z.optional(z.string()) }),
    output: z.object({
        nextCursor: z.optional(z.string()),
        entitlements: z.array(
            z.object({
                entitlementId: z.string(),
                name: z.string(),
                description: z.optional(z.string()),
                metadata: metadataSchema,
            }),
        ),
    }),
};

const grantHandlerSchema = {
    input: z.object({
        tenant: tenantSchema,
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
        tenant: tenantSchema,
        //  id returned by the account creation handler
        id: z.string(),
        // id returned by the entitlement discovery handler
        entitlementId: z.string(),
    }),
    output: z.object({
        revoked: z.boolean(),
    }),
};

// Drift detection: given the account id from account creation, return the entitlement ids the
// account currently holds, so the host can reconcile them against its recorded grants.
const readHandlerSchema = {
    input: z.object({
        tenant: tenantSchema,
        // id returned by the account creation handler
        id: z.string(),
    }),
    output: z.object({
        entitlementIds: z.array(z.string()),
    }),
};

export const entitlementHandlerInputOutputSchema = {
    discover: discoverHandlerSchema,
    grant: grantHandlerSchema,
    revoke: revokeHandlerSchema,
    read: readHandlerSchema,
};
