import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import csrf from '@fastify/csrf-protection';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import config from './config/index.js';
import { connectDB, disconnectDB, getPoolStats } from './db/pool.js';
import { upgrade } from './db/upgrade.js';
import { seed } from './db/seed.js';
import { errorHandler } from './middleware/errorHandler.js';
import { correlationId } from './middleware/correlation.js';
import { securityConfig } from './utils/security.js';
import { generatePostmanCollection } from './utils/postman.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { mfaRoutes } from './modules/mfa/mfa.routes.js';
import { apiKeyRoutes } from './modules/apikeys/apikeys.routes.js';
import { canaryRoutes } from './modules/canary/canary.routes.js';
import { tlRoutes } from './modules/tl/tl.routes.js';
import { attendanceRoutes } from './modules/attendance/attendance.routes.js';
import { ratingsRoutes } from './modules/ratings/ratings.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';

var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);

async function buildApp() {
  var app = Fastify({
    logger: { level: config.NODE_ENV === 'production' ? 'info' : 'debug', transport: config.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined },
    bodyLimit: securityConfig.maxBodySize,
    requestIdHeader: 'x-request-id',
    genReqId: function() { return 'req-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9); }
  });

  app.addHook('onRequest', correlationId);
  await app.register(fastifyStatic, { root: path.join(__dirname, '..', 'public'), prefix: '/' });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, securityConfig.cors);
  await app.register(rateLimit, { global: true, max: securityConfig.rateLimit.global.max, timeWindow: securityConfig.rateLimit.global.timeWindow });
  await app.register(cookie, { secret: config.CSRF_SECRET });
  
  try { await app.register(csrf, { cookieOpts: { httpOnly: true, sameSite: 'strict' } }); } catch(e) {}

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'TL Management API',
        version: '4.0.0',
        description: 'Enterprise-grade backend with military-grade security - MFA, API Keys, PoW, ZKP, Canary Tokens, Anomaly Detection, Audit Chain'
      }
    }
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  app.setErrorHandler(errorHandler);

  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(mfaRoutes, { prefix: '/api/v1/mfa' });
  await app.register(apiKeyRoutes, { prefix: '/api/v1/api-keys' });
  await app.register(canaryRoutes, { prefix: '/api/v1/canary' });
  await app.register(tlRoutes, { prefix: '/api/v1/tls' });
  await app.register(attendanceRoutes, { prefix: '/api/v1/attendance' });
  await app.register(ratingsRoutes, { prefix: '/api/v1/ratings' });
  await app.register(auditRoutes, { prefix: '/api/v1/audit' });

  app.get('/api/v1/postman', async function(req: any, reply: any) { return generatePostmanCollection(); });

  app.get('/api/v1/health', async function() {
    var poolStats = getPoolStats();
    return {
      status: 'ok',
      version: '4.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
        rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100
      },
      database: { provider: 'Neon PostgreSQL', region: 'ap-southeast-1 (AWS)', pool: poolStats },
      features: ['MFA/TOTP','API Keys','Audit Chain','Brute Force','Refresh Rotation','Password Reset','Proof of Work','Idempotency','Circuit Breaker','Leaky Bucket','Correlation IDs','Request Signing','Quantum KEM','Canary Tokens','Anomaly Detection','ZKP','Tokenization']
    };
  });

  app.addHook('onClose', async function() { await disconnectDB(); });
  process.on('SIGTERM', async function() { await app.close(); process.exit(0); });
  process.on('SIGINT', async function() { await app.close(); process.exit(0); });

  await connectDB();
  await upgrade();
  await seed();
  return app;
}

async function start() {
  var app = await buildApp();
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log('Server: http://localhost:' + config.PORT);
    console.log('Dashboard: http://localhost:' + config.PORT);
    console.log('Docs: http://localhost:' + config.PORT + '/docs');
  } catch(err) { app.log.error(err); process.exit(1); }
}
start();
