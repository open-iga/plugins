import * as z from 'zod/mini';
import { tenantSchema } from './connector.tenant.schema.ts';

const metadataSchema = z.optional(z.record(z.string(), z.json()));

// Handlers are idempotent: repeating an action that already took effect succeeds, `false` means it failed.

// Page token that only the connector understands; the Host passes it back as is.
const cursorSchema = z.optional(z.string());

// If an account with this email already exists, return its id with created=false and change nothing.
const creationHandlerSchema = {
    input: z.object({
        tenant: tenantSchema,
        email: z.email(),
        firstname: z.string(),
        lastname: z.string(),
        metadata: metadataSchema,
    }),
    output: z.object({
        accountId: z.string(),
        // false when an existing account was returned
        created: z.boolean(),
        metadata: metadataSchema,
    }),
};

const enableHandlerSchema = {
    input: z.object({
        tenant: tenantSchema,
        accountId: z.string(),
    }),
    output: z.object({
        enabled: z.boolean(),
    }),
};

const disableHandlerSchema = {
    input: z.object({
        tenant: tenantSchema,
        accountId: z.string(),
    }),
    output: z.object({
        disabled: z.boolean(),
    }),
};

const deleteHandlerSchema = {
    input: z.object({
        tenant: tenantSchema,
        accountId: z.string(),
    }),
    output: z.object({
        deleted: z.boolean(),
    }),
};

const readHandlerSchema = {
    input: z.object({
        tenant: tenantSchema,
        accountId: z.string(),
    }),
    // Read is an account-drift primitive: it reports whether the account still exists and
    // whether it is enabled, rather than echoing profile attributes.
    output: z.object({
        exists: z.boolean(),
        enabled: z.boolean(),
    }),
};

// Lists the tenant's accounts one page at a time; keep calling with `nextCursor` until it is missing.
const listHandlerSchema = {
    input: z.object({
        tenant: tenantSchema,
        cursor: cursorSchema,
    }),
    output: z.object({
        accounts: z.array(
            z.object({
                accountId: z.string(),
                email: z.string(),
                enabled: z.boolean(),
                firstname: z.optional(z.string()),
                lastname: z.optional(z.string()),
            }),
        ),
        nextCursor: cursorSchema,
    }),
};

export const handlerInputOutputSchema = {
    create: creationHandlerSchema,
    read: readHandlerSchema,
    enable: enableHandlerSchema,
    disable: disableHandlerSchema,
    delete: deleteHandlerSchema,
    list: listHandlerSchema,
};
