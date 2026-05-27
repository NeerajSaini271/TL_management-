import pkg from 'pg';
import config from '../config/index.js';
var Pool = pkg.Pool;

var poolStats = {
  totalConnections: 0,
  activeConnections: 0,
  idleConnections: 0,
  waitingClients: 0,
  acquiredTotal: 0,
  releasedTotal: 0,
  errors: 0,
  lastError: null as any
};

var pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('connect', function() { poolStats.totalConnections++; poolStats.activeConnections++; });
pool.on('acquire', function() { poolStats.acquiredTotal++; });
pool.on('release', function() { poolStats.releasedTotal++; poolStats.activeConnections = Math.max(0, poolStats.activeConnections - 1); });
pool.on('remove', function() { poolStats.totalConnections = Math.max(0, poolStats.totalConnections - 1); poolStats.activeConnections = Math.max(0, poolStats.activeConnections - 1); });
pool.on('error', function(err: any) { poolStats.errors++; poolStats.lastError = err.message; console.error('Pool error:', err.message); });

export async function connectDB(retries: number = 3): Promise<void> {
  var attempt = 0;
  while (attempt < retries) {
    try {
      var c = await pool.connect();
      c.release();
      console.log('Neon DB connected (attempt ' + (attempt + 1) + ')');
      return;
    } catch (err: any) {
      attempt++;
      console.error('DB connection attempt ' + attempt + ' failed:', err.message);
      if (attempt >= retries) throw err;
      await new Promise(function(r) { setTimeout(r, 2000 * attempt); });
    }
  }
}

export async function disconnectDB(): Promise<void> { await pool.end(); }

export function getPoolStats() {
  return {
    ...poolStats,
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
}

export default pool;
