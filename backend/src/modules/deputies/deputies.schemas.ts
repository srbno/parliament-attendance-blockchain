import { z } from 'zod';

export const createDeputySchema = z.object({
  publicIdentifier: z.string().min(1),
  name: z.string().min(1),
  party: z.string().min(1),
  electoralCircle: z.string().min(1),
  active: z.boolean().default(true)
});

export const updateDeputySchema = createDeputySchema.partial();

export type CreateDeputyInput = z.infer<typeof createDeputySchema>;
export type UpdateDeputyInput = z.infer<typeof updateDeputySchema>;
