import { z } from 'zod/mini';
import { connectorConfigSchema } from './connector.config.schema.ts';

export const connectorSettingsSchema = z.object({
    name: z.string().check(z.minLength(1)),
    description: z.string().check(z.minLength(1)),
    config: connectorConfigSchema,
    allowedDomains: z.array(z.string().check(z.minLength(1))),
});

export type ConnectorSettings = z.infer<typeof connectorSettingsSchema>;
