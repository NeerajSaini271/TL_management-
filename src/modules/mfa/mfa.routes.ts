import pool from '../../db/pool.js';
import { authenticate } from '../../middleware/auth.js';
import { generateTOTPSecret, generateQRCode, verifyTOTP } from '../../utils/totp.js';

export async function mfaRoutes(app: any) {
  app.addHook('preHandler', authenticate);

  app.get('/setup', async function(req: any, reply: any) {
    const c = await pool.connect();
    try {
      const user = await c.query('SELECT email, totp_enabled FROM users WHERE id = $1', [req.user.id]);
      if (user.rows[0].totp_enabled) {
        return reply.send({ success: true, enabled: true });
      }
      const { secret, otpauth_url } = generateTOTPSecret(user.rows[0].email);
      const qrCode = await generateQRCode(otpauth_url);
      await c.query('UPDATE users SET totp_secret = $1 WHERE id = $2', [secret, req.user.id]);
      reply.send({ success: true, enabled: false, secret, qrCode });
    } finally { c.release(); }
  });

  app.post('/verify', async function(req: any, reply: any) {
    const { token } = req.body || {};
    if (!token) return reply.status(400).send({ success: false, message: 'Token required' });
    const c = await pool.connect();
    try {
      const user = await c.query('SELECT totp_secret FROM users WHERE id = $1', [req.user.id]);
      if (!user.rows[0].totp_secret) return reply.status(400).send({ success: false, message: 'Setup MFA first' });
      const valid = verifyTOTP(token, user.rows[0].totp_secret);
      if (valid) {
        await c.query('UPDATE users SET totp_enabled = true WHERE id = $1', [req.user.id]);
        return reply.send({ success: true, message: 'MFA enabled' });
      }
      reply.status(400).send({ success: false, message: 'Invalid token' });
    } finally { c.release(); }
  });

  app.post('/disable', async function(req: any, reply: any) {
    const { token } = req.body || {};
    const c = await pool.connect();
    try {
      const user = await c.query('SELECT totp_secret FROM users WHERE id = $1', [req.user.id]);
      if (token) {
        const valid = verifyTOTP(token, user.rows[0].totp_secret);
        if (!valid) return reply.status(400).send({ success: false, message: 'Invalid token' });
      }
      await c.query('UPDATE users SET totp_enabled = false, totp_secret = NULL WHERE id = $1', [req.user.id]);
      reply.send({ success: true, message: 'MFA disabled' });
    } finally { c.release(); }
  });
}
