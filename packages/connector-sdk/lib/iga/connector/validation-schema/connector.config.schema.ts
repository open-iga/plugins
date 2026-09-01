import * as z from 'zod/mini';

export const connectorConfigSchema = z.array(
    z.object({
        name: z.string().check(z.minLength(1)),
        description: z.string().check(z.minLength(1)),
        required: z.boolean(),
    }),
);

export type ConnectorConfig = z.infer<typeof connectorConfigSchema>;
