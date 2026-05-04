import { z } from 'zod';

const dateString = z.string().datetime();

export const createSessionSchema = z.object({
  title: z.string().min(1),
  sessionType: z.enum(['PLENARY', 'COMMITTEE', 'SUBCOMMITTEE', 'VOTING', 'WORKGROUP', 'OTHER']),
  locationId: z.string().regex(/^\d+$/),
  scheduledStart: dateString,
  scheduledEnd: dateString,
  checkinStart: dateString,
  checkinEnd: dateString,
  status: z.enum(['DRAFT', 'OPEN', 'CLOSED', 'CANCELLED']).default('DRAFT'),
  allowMultipleCheckins: z.boolean().default(false)
});

export const updateSessionSchema = createSessionSchema.partial();

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
