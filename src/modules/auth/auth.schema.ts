import { z } from 'zod';
export var registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
  department: z.string().min(2).max(50).optional(),
});
export var loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export var changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });
export var forgotPasswordSchema = z.object({ email: z.string().email() });
export var resetPasswordSchema = z.object({ token: z.string().min(1), password: z.string().min(8) });
