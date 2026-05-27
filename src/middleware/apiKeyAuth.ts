import pool from '../db/pool.js';
import { hashAPIKey } from '../utils/apikey.js';
import { UnauthorizedError } from '../common/errors.js';

export async function apiKeyAuth(request: any, reply: any) {
  const apiKey = request.headers['x-api-key'] as string;
  if (!apiKey) throw new UnauthorizedError('API key required');
  const hash = hashAPIKey(apiKey);
  const c = await pool.connect();
  try {
    const key = await c.query("SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())", [hash]);
    if (key.rows.length === 0) throw new UnauthorizedError('Invalid API key');
    await c.query('UPDATE api_keys SET last_used = NOW() WHERE id = $1', [key.rows[0].id]);
    const user = await c.query('SELECT id, email, role FROM users WHERE id = $1', [key.rows[0].user_id]);
    request.user = user.rows[0];
  } finally { c.release(); }
}
