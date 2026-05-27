import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import config from './config/index.js';
import { connectDB, disconnectDB } from './db/prisma.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { tlRoutes } from './modules/tl/tl.routes.js';
import { attendanceRoutes } from './modules/attendance/attendance.routes.js';
import { ratingsRoutes } from './modules/ratings/ratings.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';

async function buildApp() {
  var app = Fastify({
    logger: { level: 'debug', transport: { target: 'pino-pretty' } }
  });

  await app.register(helmet);
  await app.register(cors, { origin: true, credentials: true });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(cookie, { secret: config.CSRF_SECRET });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'TL Management & Attendance API',
        version: '1.0.0',
        description: 'Production-grade backend for TL Management System'
      }
    }
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  app.setErrorHandler(errorHandler);

  // Register all modules
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(tlRoutes, { prefix: '/api/v1/tls' });
  await app.register(attendanceRoutes, { prefix: '/api/v1/attendance' });
  await app.register(ratingsRoutes, { prefix: '/api/v1/ratings' });
  await app.register(auditRoutes, { prefix: '/api/v1/audit' });

  app.get('/api/v1/health', async function() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  app.addHook('onClose', async function() { await disconnectDB(); });
  await connectDB();
  return app;
}

async function start() {
  var app = await buildApp();
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log('Server: http://localhost:' + config.PORT);
    console.log('Docs: http://localhost:' + config.PORT + '/docs');
  } catch(err) { app.log.error(err); process.exit(1); }
}
start();
