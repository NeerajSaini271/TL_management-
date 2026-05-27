import pool from '../../db/pool.js';
import { authenticate } from '../../middleware/auth.js';
import { generateAPIKey, hashAPIKey } from '../../utils/apikey.js';

export async function apiKeyRoutes(app: any) {
  app.addHook('preHandler', authenticate);

  app.post('/', async function(req: any, reply: any) {
    const { name, scopes } = req.body || {};
    if (!name) return reply.status(400).send({ success: false, message: 'Name required' });
    const { prefix, key, hash } = generateAPIKey();
    const c = await pool.connect();
    try {
      await c.query('INSERT INTO api_keys (user_id, name, prefix, key_hash, scopes) VALUES ($1,$2,$3,$4,$5)', [req.user.id, name, prefix, hash, scopes || 'read']);
      reply.status(201).send({ success: true, data: { name, prefix, key, scopes: scopes || 'read' } });
    } finally { c.release(); }
  });

  app.get('/', async function(req: any, reply: any) {
    const c = await pool.connect();
    try {
      const keys = await c.query('SELECT id, name, prefix, scopes, last_used, is_active, created_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
      reply.send({ success: true, data: keys.rows });
    } finally { c.release(); }
  });

  app.delete('/:id', async function(req: any, reply: any) {
    const c = await pool.connect();
    try {
      await c.query('UPDATE api_keys SET is_active = false WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
      reply.send({ success: true, message: 'API key revoked' });
    } finally { c.release(); }
  });
}
