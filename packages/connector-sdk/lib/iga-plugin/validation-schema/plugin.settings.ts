import { z } from 'zod/mini';
import { pluginConfigSchema } from './plugin.config.schema.ts';

export const pluginSettingsSchema = z.object({
    name: z.string().check(z.minLength(1)),
    description: z.string().check(z.minLength(1)),
    config: pluginConfigSchema,
    allowedDomains: z.array(z.string().check(z.minLength(1))),
});

export type PluginSettings = z.infer<typeof pluginSettingsSchema>;
