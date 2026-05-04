import { z } from 'zod';

export const submitAttendanceSchema = z.object({
  sessionId: z.string().regex(/^\d+$/),
  gps: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracyMeters: z.number().positive()
  }),
  clientRequestId: z.string().uuid()
});

export type SubmitAttendanceInput = z.infer<typeof submitAttendanceSchema>;
