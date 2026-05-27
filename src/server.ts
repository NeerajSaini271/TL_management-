import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import config from './config/index.js';
import { connectDB, disconnectDB } from './db/prisma.js';
import { connectRedis } from './plugins/redis.js';
import { errorHandler } from './middleware/errorHandler.js';

async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: config.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
    },
  });

  // Security plugins
  await app.register(helmet);
  await app.register(cors, {
    origin: true, // tighten in production
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
  await app.register(cookie, {
    secret: config.CSRF_SECRET,
  });

  // Swagger
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'TL Management API',
        version: '1.0.0',
      },
    },
  });
  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // Graceful shutdown hooks
  app.addHook('onClose', async () => {
    await disconnectDB();
  });

  // Connect to DB and Redis
  await connectDB();
  await connectRedis();

  // Register routes (stub – we'll add real routes later)
  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}

async function start() {
  const app = await buildApp();
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log(`🚀 Server running on http://localhost:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
