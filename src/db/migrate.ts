import pool from "./pool.js";

export async function migrate() {
  var c = await pool.connect();
  try {
    await c.query("CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, name VARCHAR(100) NOT NULL, role VARCHAR(20) DEFAULT EMPLOYEE, department VARCHAR(50), is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())");
    await c.query("CREATE TABLE IF NOT EXISTS refresh_tokens (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), token_id VARCHAR(255) UNIQUE NOT NULL, user_id UUID REFERENCES users(id), family VARCHAR(255), revoked_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())");
    await c.query("CREATE TABLE IF NOT EXISTS attendance (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id), date TIMESTAMP DEFAULT NOW(), status VARCHAR(20), is_late BOOLEAN DEFAULT false, comment TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())");
    await c.query("CREATE TABLE IF NOT EXISTS ratings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id), month VARCHAR(7), score FLOAT, comment TEXT, reviewer_id UUID, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())");
    await c.query("CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id), action VARCHAR(50), resource VARCHAR(50), detail TEXT, ip_address VARCHAR(45), created_at TIMESTAMP DEFAULT NOW())");
    console.log("Tables created");
  } finally { c.release(); }
}
