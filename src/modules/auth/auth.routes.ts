import { authService } from './auth.service.js';
import { validateBody } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { registerSchema, loginSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.schema.js';
import { generateChallenge, verifyPoW } from '../../utils/pow.js';
import { checkIdempotency, storeIdempotency } from '../../utils/idempotency.js';
import { loginBucket } from '../../utils/leakyBucket.js';
import { CanaryToken } from '../../utils/canaryTokens.js';

export async function authRoutes(app: any) {
  app.get('/challenge', async function(req: any, reply: any) {
    var challenge = generateChallenge(4);
    reply.send({ success: true, data: challenge });
  });

  app.post('/register', { preHandler: [validateBody(registerSchema)] }, async function(req: any, reply: any) {
    var idemKey = req.headers['idempotency-key'];
    if (idemKey) {
      var cached = checkIdempotency(idemKey);
      if (cached) return reply.status(cached.status).send(JSON.parse(cached.body));
    }
    var r = await authService.register(req.body);
    if (idemKey) storeIdempotency(idemKey, 201, JSON.stringify({ success: true, data: r }));
    reply.status(201).send({ success: true, data: r });
  });

  app.post('/login', { preHandler: [validateBody(loginSchema)] }, async function(req: any, reply: any) {
    var bucketCheck = loginBucket.allow(req.ip);
    if (!bucketCheck.allowed) {
      return reply.status(429).send({ success: false, message: 'Too many login attempts', retryAfter: bucketCheck.retryAfter });
    }
    
    if (req.body.challenge && req.body.nonce !== undefined) {
      var validPow = verifyPoW(req.body.challenge, req.body.nonce);
      if (!validPow) return reply.status(400).send({ success: false, message: 'Invalid proof of work' });
    }
    
    var result = await authService.login(req.body, req.ip, req.headers['user-agent']);
    reply.setCookie('access_token', result.accessToken, { httpOnly: true, secure: false, sameSite: 'strict', path: '/', maxAge: 900 });
    reply.setCookie('refresh_token', result.refreshToken, { httpOnly: true, secure: false, sameSite: 'strict', path: '/', maxAge: 604800 });
    reply.send({ success: true, data: { user: result.user, security: result.security } });
  });

  app.post('/refresh', async function(req: any, reply: any) {
    var token = (req.body && req.body.refreshToken) || req.cookies.refresh_token;
    if (!token) return reply.status(400).send({ success: false, message: 'Refresh token required' });
    var tokens = await authService.refreshToken(token);
    reply.setCookie('access_token', tokens.accessToken, { httpOnly: true, secure: false, sameSite: 'strict', path: '/', maxAge: 900 });
    reply.setCookie('refresh_token', tokens.refreshToken, { httpOnly: true, secure: false, sameSite: 'strict', path: '/', maxAge: 604800 });
    reply.send({ success: true });
  });

  app.get('/me', { preHandler: [authenticate] }, async function(req: any, reply: any) {
    var u = await authService.getCurrentUser(req.user.id);
    reply.send({ success: true, data: u });
  });

  app.put('/change-password', { preHandler: [authenticate, validateBody(changePasswordSchema)] }, async function(req: any, reply: any) {
    await authService.changePassword(req.user.id, req.body);
    reply.send({ success: true, message: 'Password changed successfully' });
  });

  app.post('/forgot-password', { preHandler: [validateBody(forgotPasswordSchema)] }, async function(req: any, reply: any) {
    await authService.forgotPassword(req.body.email);
    reply.send({ success: true, message: 'If email exists, reset link sent' });
  });

  app.post('/reset-password', { preHandler: [validateBody(resetPasswordSchema)] }, async function(req: any, reply: any) {
    await authService.resetPassword(req.body);
    reply.send({ success: true, message: 'Password reset successfully' });
  });

  app.post('/logout', { preHandler: authenticate }, async function(req: any, reply: any) {
    await authService.logout(req.user.id, req.cookies.refresh_token);
    reply.clearCookie('access_token', { path: '/' });
    reply.clearCookie('refresh_token', { path: '/' });
    reply.send({ success: true, message: 'Logged out' });
  });
}
