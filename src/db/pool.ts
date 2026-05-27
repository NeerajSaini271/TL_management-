import pkg from 'pg';
import config from '../config/index.js';
const { Pool } = pkg;
const pool = new Pool({ connectionString: config.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 20 });
pool.on('error', (err: any) => console.error('Pool error:', err));
export async function connectDB() { const c = await pool.connect(); c.release(); console.log('DB connected'); }
export async function disconnectDB() { await pool.end(); }
export default pool;