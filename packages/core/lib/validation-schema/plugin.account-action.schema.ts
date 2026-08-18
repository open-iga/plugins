import { z } from 'zod';
import { pluginConfigSchema } from './plugin.config.schema.ts';

// Build-time validation schema for an account action
export const pluginAccountActionSchema = z.object({
    type: z.enum(['create', 'read', 'update', 'enable', 'disable', 'delete']),
    description: z.string(),
    endpoints: z.array(
        z.object({
            method: z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']),
            url: z
                .string()
                .regex(/^https?:\/\//, 'Upstream URL must start with http:// or https:// (allow-listed by Host)'),
        }),
    ),
    config: pluginConfigSchema.optional(),
    handler: z.custom<(...args: unknown[]) => unknown>(
        (input) => typeof input === 'function',
        'handler must be a function',
    ),
});
