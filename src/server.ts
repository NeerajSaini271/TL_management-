import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import config from './config/index.js';
import { connectDB, disconnectDB } from './db/pool.js';
import { upgrade } from './db/upgrade.js';
import { seed } from './db/seed.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { mfaRoutes } from './modules/mfa/mfa.routes.js';
import { apiKeyRoutes } from './modules/apikeys/apikeys.routes.js';
import { tlRoutes } from './modules/tl/tl.routes.js';
import { attendanceRoutes } from './modules/attendance/attendance.routes.js';
import { ratingsRoutes } from './modules/ratings/ratings.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';

async function buildApp() {
  const app = Fastify({ logger: { level: 'debug', transport: { target: 'pino-pretty' } } });
  await app.register(helmet);
  await app.register(cors, { origin: true, credentials: true });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(cookie, { secret: config.CSRF_SECRET });
  await app.register(swagger, { openapi: { info: { title: 'TL Management API', version: '2.0.0', description: 'Enterprise-grade backend with MFA, API Keys, and Tamper-Proof Audit' } } });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  app.setErrorHandler(errorHandler);
  
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(mfaRoutes, { prefix: '/api/v1/mfa' });
  await app.register(apiKeyRoutes, { prefix: '/api/v1/api-keys' });
  await app.register(tlRoutes, { prefix: '/api/v1/tls' });
  await app.register(attendanceRoutes, { prefix: '/api/v1/attendance' });
  await app.register(ratingsRoutes, { prefix: '/api/v1/ratings' });
  await app.register(auditRoutes, { prefix: '/api/v1/audit' });
  
  app.get('/api/v1/health', async () => ({ status: 'ok', db: 'Neon PostgreSQL', features: ['MFA/TOTP', 'API Keys', 'Audit Chain'] }));
  app.addHook('onClose', async () => { await disconnectDB(); });
  await connectDB();
  await upgrade();
  await seed();
  return app;
}

async function start() {
  const app = await buildApp();
  try { await app.listen({ port: config.PORT, host: '0.0.0.0' }); console.log('Server: http://localhost:' + config.PORT); }
  catch(err) { app.log.error(err); process.exit(1); }
}
start();
