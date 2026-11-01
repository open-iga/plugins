import * as z from 'zod/mini';

// The tenant an operation runs against; `id` is its id in the target system.
export const tenantSchema = z.object({
    id: z.string(),
});
