import * as z from 'zod/mini';
import { pluginConfigSchema } from './plugin.config.schema.ts';

// Build-time validation schema for an account action
export const pluginAccountActionSchema = z.object({
    type: z.enum(['create']),
    description: z.string(),
    endpoints: z.array(
        z.object({
            method: z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']),
            url: z
                .string()
                .check(z.regex(/^https?:\/\//, 'Upstream URL must start with http:// or https:// (allow-listed by Host)')),
        }),
    ),
    config: z.optional(pluginConfigSchema),
    handler: z.custom<(...args: unknown[]) => unknown>(
        (input) => typeof input === 'function',
        'handler must be a function',
    ),
});

export type PluginAccountAction = z.infer<typeof pluginAccountActionSchema>;
