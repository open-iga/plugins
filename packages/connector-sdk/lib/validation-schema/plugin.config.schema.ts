import * as z from 'zod/mini';

export const pluginConfigSchema = z.array(
    z.object({
        name: z.string().check(z.minLength(1)),
        description: z.string().check(z.minLength(1)),
        required: z.boolean(),
    }),
);

export type PluginConfig = z.infer<typeof pluginConfigSchema>;
