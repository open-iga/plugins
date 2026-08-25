import * as z from 'zod/mini';

const creationHandlerInputSchema = z.object({
    email: z.email(),
    firstname: z.string(),
    lastname: z.string(),
    metadata: z.optional(z.record(z.string(), z.unknown())),
});

const creationHandlerOutputSchema = z.object({
    id: z.string(),
    metadata: z.optional(z.record(z.string(), z.unknown())),
});

export const handlerInputOutputSchema = {
    create: {
        input: creationHandlerInputSchema,
        output: creationHandlerOutputSchema,
    },
};
