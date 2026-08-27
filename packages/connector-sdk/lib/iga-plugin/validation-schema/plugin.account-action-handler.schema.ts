import * as z from 'zod/mini';

const metadataSchema = z.optional(z.record(z.string(), z.json()));

const creationHandlerInputSchema = z.object({
    email: z.email(),
    firstname: z.string(),
    lastname: z.string(),
    metadata: metadataSchema,
});

const creationHandlerOutputSchema = z.object({
    id: z.string(),
    metadata: metadataSchema,
});

export const handlerInputOutputSchema = {
    create: {
        input: creationHandlerInputSchema,
        output: creationHandlerOutputSchema,
    },
};
