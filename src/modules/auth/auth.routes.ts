import { authService } from './auth.service.js';
import { validateBody } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { registerSchema, loginSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.schema.js';

export async function authRoutes(app) {
  app.post('/register', { preHandler: [validateBody(registerSchema)] }, async function(req, reply) {
    var r = await authService.register(req.body);
    reply.status(201).send({ success: true, data: r });
  });

  app.post('/login', { preHandler: [validateBody(loginSchema)] }, async function(req, reply) {
    var result = await authService.login(req.body, req.ip);
    reply.setCookie('access_token', result.accessToken, { httpOnly: true, secure: false, sameSite: 'strict', path: '/', maxAge: 900 });
    reply.setCookie('refresh_token', result.refreshToken, { httpOnly: true, secure: false, sameSite: 'strict', path: '/', maxAge: 604800 });
    reply.send({ success: true, data: { user: result.user } });
  });

  app.get('/me', { preHandler: [authenticate] }, async function(req, reply) {
    var u = await authService.getCurrentUser(req.user.id);
    reply.send({ success: true, data: u });
  });

  app.put('/change-password', { preHandler: [authenticate, validateBody(changePasswordSchema)] }, async function(req, reply) {
    await authService.changePassword(req.user.id, req.body);
    reply.send({ success: true, message: 'Password changed successfully' });
  });

  app.post('/logout', { preHandler: [authenticate] }, async function(req, reply) {
    var jti = '';
    try { var parts = req.cookies.access_token.split('.'); jti = JSON.parse(Buffer.from(parts[1], 'base64').toString()).jti; } catch(e) {}
    await authService.logout(req.user.id, req.cookies.refresh_token, jti);
    reply.clearCookie('access_token', { path: '/' });
    reply.clearCookie('refresh_token', { path: '/' });
    reply.send({ success: true, message: 'Logged out' });
  });
}
