import pool from './pool.js';

export async function upgrade() {
  var c = await pool.connect();
  try {
    await c.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64)");
    await c.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false");
    await c.query("ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS chain_hash VARCHAR(64)");
    await c.query("CREATE TABLE IF NOT EXISTS api_keys (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), name VARCHAR(100), prefix VARCHAR(16), key_hash VARCHAR(64) UNIQUE, scopes TEXT, last_used TIMESTAMP, expires_at TIMESTAMP, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW())");
    console.log('Schema upgraded for MFA + API Keys + Audit Chain');
  } finally { c.release(); }
}
