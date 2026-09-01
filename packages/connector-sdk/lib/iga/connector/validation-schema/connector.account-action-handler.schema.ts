import * as z from 'zod/mini';

const metadataSchema = z.optional(z.record(z.string(), z.json()));

const creationHandlerSchema = {
    input: z.object({
        email: z.email(),
        firstname: z.string(),
        lastname: z.string(),
        metadata: metadataSchema,
    }),
    output: z.object({
        id: z.string(),
        metadata: metadataSchema,
    }),
};

const enableHandlerSchema = {
    input: z.object({
        id: z.string(),
    }),
    output: z.object({
        enabled: z.boolean(),
    }),
};

const disableHandlerSchema = {
    input: z.object({
        id: z.string(),
    }),
    output: z.object({
        disabled: z.boolean(),
    }),
};

const deleteHandlerSchema = {
    input: z.object({
        id: z.string(),
    }),
    output: z.object({
        deleted: z.boolean(),
    }),
};

const readHandlerSchema = {
    input: z.object({
        id: z.string(),
    }),
    // Read is an account-drift primitive: it reports whether the account still exists and
    // whether it is enabled, rather than echoing profile attributes.
    output: z.object({
        exists: z.boolean(),
        enabled: z.boolean(),
    }),
};

export const handlerInputOutputSchema = {
    create: creationHandlerSchema,
    read: readHandlerSchema,
    enable: enableHandlerSchema,
    disable: disableHandlerSchema,
    delete: deleteHandlerSchema,
};
