import { z } from 'zod';

export var markAttendanceSchema = z.object({
  status: z.enum(['PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY']),
  comment: z.string().max(500).optional(),
});
