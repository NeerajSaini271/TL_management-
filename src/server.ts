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
import { canaryRoutes } from './modules/canary/canary.routes.js';
import { tlRoutes } from './modules/tl/tl.routes.js';
import { attendanceRoutes } from './modules/attendance/attendance.routes.js';
import { ratingsRoutes } from './modules/ratings/ratings.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';

async function buildApp() {
  var app = Fastify({ logger: { level: 'info', transport: { target: 'pino-pretty' } } });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
  });

  await app.register(cors, {
    origin: ['http://localhost:3000', 'http://localhost:5000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Correlation-ID', 'Idempotency-Key'],
  });

  await app.register(rateLimit, { max: 500, timeWindow: '1 minute' });
  await app.register(cookie, { secret: config.CSRF_SECRET });
  await app.register(swagger, { openapi: { info: { title: 'TL Management API', version: '5.0.0' } } });
  await app.register(swaggerUi, { routePrefix: '/' });

  app.setErrorHandler(async function(error: any, request: any, reply: any) {
    request.log.error({ err: error, body: request.body, url: request.url, method: request.method }, 'Request error');
    var statusCode = error.statusCode || 500;
    var message = error.message || 'Internal server error';
    if (error.validation) { statusCode = 400; message = error.message; }
    if (error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') { statusCode = 415; message = 'Unsupported Media Type'; }
    reply.status(statusCode).send({ success: false, message: message, code: error.code || 'UNKNOWN' });
  });

  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(mfaRoutes, { prefix: '/api/v1/mfa' });
  await app.register(apiKeyRoutes, { prefix: '/api/v1/api-keys' });
  await app.register(canaryRoutes, { prefix: '/api/v1/canary' });
  await app.register(tlRoutes, { prefix: '/api/v1/tls' });
  await app.register(attendanceRoutes, { prefix: '/api/v1/attendance' });
  await app.register(ratingsRoutes, { prefix: '/api/v1/ratings' });
  await app.register(auditRoutes, { prefix: '/api/v1/audit' });

  app.get('/api/v1/health', async function() {
    return { status: 'ok', db: 'Neon PostgreSQL', timestamp: new Date().toISOString() };
  });

  app.addHook('onClose', async function() { await disconnectDB(); });
  await connectDB();
  await upgrade();
  await seed();
  return app;
}

async function start() {
  var app = await buildApp();
  try { await app.listen({ port: config.PORT, host: '0.0.0.0' }); console.log('Server: http://localhost:' + config.PORT); }
  catch(err) { console.error(err); process.exit(1); }
}
start();

