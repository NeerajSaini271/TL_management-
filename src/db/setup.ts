import pool from './pool.js';
import argon2 from 'argon2';
var c = await pool.connect();
try {
  await c.query('DROP TABLE IF EXISTS audit_logs, ratings, attendance, refresh_tokens, users CASCADE');
  await c.query("CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, name VARCHAR(100) NOT NULL, role VARCHAR(20) DEFAULT 'EMPLOYEE', department VARCHAR(50), is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())");
  await c.query("CREATE TABLE refresh_tokens (id SERIAL PRIMARY KEY, token_id VARCHAR(255) UNIQUE NOT NULL, user_id INTEGER REFERENCES users(id), family VARCHAR(255), revoked_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())");
  await c.query("CREATE TABLE attendance (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), date TIMESTAMP DEFAULT NOW(), status VARCHAR(20), is_late BOOLEAN DEFAULT false, comment TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())");
  await c.query("CREATE TABLE ratings (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), month VARCHAR(7), score FLOAT, comment TEXT, reviewer_id INTEGER, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())");
  await c.query("CREATE TABLE audit_logs (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), action VARCHAR(50), resource VARCHAR(50), detail TEXT, ip_address VARCHAR(45), created_at TIMESTAMP DEFAULT NOW())");
  var ap = await argon2.hash('Admin@123!');
  var tp = await argon2.hash('TL@123!');
  var ep = await argon2.hash('Employee@123!');
  await c.query('INSERT INTO users (email, password_hash, name, role, department) VALUES ($1, $2, $3, $4, $5)', ['admin@company.com', ap, 'Admin', 'ADMIN', 'Engineering']);
  await c.query('INSERT INTO users (email, password_hash, name, role, department) VALUES ($1, $2, $3, $4, $5)', ['tl@company.com', tp, 'TL', 'TL', 'Product']);
  await c.query('INSERT INTO users (email, password_hash, name, role, department) VALUES ($1, $2, $3, $4, $5)', ['employee@company.com', ep, 'Employee', 'EMPLOYEE', 'Product']);
  console.log('Setup complete!');
} finally { c.release(); process.exit(0); }
