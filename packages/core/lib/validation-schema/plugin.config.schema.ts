import { z } from 'zod';

export const pluginConfigSchema = z.array(
    z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        required: z.boolean(),
    }),
);

export type PluginConfig = z.infer<typeof pluginConfigSchema>;
