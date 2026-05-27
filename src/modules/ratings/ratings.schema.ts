import { z } from 'zod';

export var createRatingSchema = z.object({
  userId: z.string().uuid(),
  month: z.string().regex(/^\\d{4}-\\d{2}$/),
  score: z.number().min(1).max(10),
  comment: z.string().max(1000).optional(),
});
