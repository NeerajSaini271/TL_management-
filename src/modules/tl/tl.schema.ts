import { z } from 'zod';

export var createTLSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
  department: z.string().min(2).max(50),
});

export var updateTLSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  department: z.string().min(2).max(50).optional(),
  isActive: z.boolean().optional(),
});
