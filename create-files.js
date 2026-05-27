const fs = require('fs');
const path = require('path');

const files = {
'src/config/index.ts': \import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),
  CSRF_SECRET: z.string().min(32),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z.enum(['true', 'false']).transform(function(v) { return v === 'true'; }),
});

var parsed = envSchema.safeParse(process.env);
if (!parsed.success) { console.error(parsed.error.flatten()); process.exit(1); }

export var config = parsed.data;
export default config;\,

'src/db/prisma.ts': \import { PrismaClient } from '@prisma/client';
import config from '../config/index.js';

var prisma = new PrismaClient({
  log: config.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export async function connectDB() { await prisma.\(); }
export async function disconnectDB() { await prisma.\(); }
export default prisma;\,

'src/plugins/redis.ts': \import Redis from 'ioredis';
import config from '../config/index.js';

var redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
redis.on('error', function(err) { console.error('Redis error:', err); });
export async function connectRedis() { await redis.ping(); }
export default redis;\,

'src/types/auth.ts': \export var Role;
(function (Role) {
  Role["ADMIN"] = "ADMIN";
  Role["MANAGER"] = "MANAGER";
  Role["TL"] = "TL";
  Role["EMPLOYEE"] = "EMPLOYEE";
})(Role || (Role = {}));

export var RoleHierarchy = {};
RoleHierarchy[Role.ADMIN] = 4;
RoleHierarchy[Role.MANAGER] = 3;
RoleHierarchy[Role.TL] = 2;
RoleHierarchy[Role.EMPLOYEE] = 1;\,

'src/utils/jwt.ts': \import jwt from 'jsonwebtoken';
import config from '../config/index.js';

export function signAccessToken(payload) {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, { expiresIn: config.JWT_ACCESS_EXPIRATION, jwtid: crypto.randomUUID() });
}

export function signRefreshToken(userId, tokenId) {
  return jwt.sign({ sub: userId, tokenId: tokenId }, config.JWT_REFRESH_SECRET, { expiresIn: config.JWT_REFRESH_EXPIRATION, jwtid: tokenId });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, config.JWT_REFRESH_SECRET);
}\,

'src/common/errors.ts': \export var AppError = (function() {
  function AppError(message, statusCode) {
    Error.call(this, message);
    this.statusCode = statusCode;
  }
  AppError.prototype = Object.create(Error.prototype);
  return AppError;
})();

export var BadRequestError = (function() {
  function BadRequestError(m) {
    if (!m) m = 'Bad request';
    AppError.call(this, m, 400);
  }
  BadRequestError.prototype = Object.create(AppError.prototype);
  return BadRequestError;
})();

export var UnauthorizedError = (function() {
  function UnauthorizedError(m) {
    if (!m) m = 'Unauthorized';
    AppError.call(this, m, 401);
  }
  UnauthorizedError.prototype = Object.create(AppError.prototype);
  return UnauthorizedError;
})();

export var ForbiddenError = (function() {
  function ForbiddenError(m) {
    if (!m) m = 'Forbidden';
    AppError.call(this, m, 403);
  }
  ForbiddenError.prototype = Object.create(AppError.prototype);
  return ForbiddenError;
})();

export var NotFoundError = (function() {
  function NotFoundError(m) {
    if (!m) m = 'Not found';
    AppError.call(this, m, 404);
  }
  NotFoundError.prototype = Object.create(AppError.prototype);
  return NotFoundError;
})();

export var ConflictError = (function() {
  function ConflictError(m) {
    if (!m) m = 'Conflict';
    AppError.call(this, m, 409);
  }
  ConflictError.prototype = Object.create(AppError.prototype);
  return ConflictError;
})();\,

'src/middleware/errorHandler.ts': \import { AppError } from '../common/errors.js';
import config from '../config/index.js';

export function errorHandler(error, request, reply) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({ success: false, message: error.message });
  }
  if (error.code === 'P2002') {
    return reply.status(409).send({ success: false, message: 'Record already exists' });
  }
  request.log.error(error);
  reply.status(500).send({ success: false, message: config.NODE_ENV === 'production' ? 'Internal server error' : error.message });
}\,

'src/middleware/validate.ts': \import { BadRequestError } from '../common/errors.js';

export function validateBody(schema) {
  return async function(req, _reply) {
    var r = schema.safeParse(req.body);
    if (!r.success) throw new BadRequestError(r.error.issues.map(function(i) { return i.message; }).join(', '));
    req.body = r.data;
  };
}

export function validateQuery(schema) {
  return async function(req, _reply) {
    var r = schema.safeParse(req.query);
    if (!r.success) throw new BadRequestError(r.error.issues.map(function(i) { return i.message; }).join(', '));
    req.query = r.data;
  };
}

export function validateParams(schema) {
  return async function(req, _reply) {
    var r = schema.safeParse(req.params);
    if (!r.success) throw new BadRequestError(r.error.issues.map(function(i) { return i.message; }).join(', '));
    req.params = r.data;
  };
}\,

'src/middleware/auth.ts': \import { UnauthorizedError, ForbiddenError } from '../common/errors.js';
import { verifyAccessToken } from '../utils/jwt.js';
import redis from '../plugins/redis.js';
import { RoleHierarchy, Role } from '../types/auth.js';

export async function authenticate(request, reply) {
  var token = request.cookies.access_token;
  if (!token) throw new UnauthorizedError('Access token missing');
  var payload;
  try { payload = verifyAccessToken(token); } catch(e) { throw new UnauthorizedError('Invalid token'); }
  var blacklisted = await redis.get('blacklist:access:' + payload.jti);
  if (blacklisted) throw new UnauthorizedError('Token revoked');
  request.user = { id: payload.sub, role: payload.role, email: '' };
}

export function authorize() {
  var allowedRoles = Array.from(arguments);
  return async function(request, reply) {
    if (!request.user) throw new UnauthorizedError('Not authenticated');
    var has = allowedRoles.some(function(r) { return RoleHierarchy[request.user.role] >= RoleHierarchy[r]; });
    if (!has) throw new ForbiddenError('Insufficient permissions');
  };
}\,

'src/modules/auth/auth.schema.ts': \import { z } from 'zod';

export var registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
  department: z.string().min(2).max(50).optional(),
});

export var loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export var refreshSchema = z.object({ refreshToken: z.string().min(1).optional() });
export var forgotPasswordSchema = z.object({ email: z.string().email() });
export var resetPasswordSchema = z.object({ token: z.string().min(1), password: z.string().min(8) });
export var changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });\,

'src/modules/auth/auth.service.ts': \import argon2 from 'argon2';
import crypto from 'crypto';
import prisma from '../../db/prisma.js';
import redis from '../../plugins/redis.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { UnauthorizedError, ConflictError, BadRequestError, NotFoundError } from '../../common/errors.js';

export var AuthService = (function() {
  function AuthService() {}
  
  AuthService.prototype.register = async function(input) {
    var existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictError('Email already registered');
    var hash = await argon2.hash(input.password, { type: argon2.argon2id });
    var user = await prisma.user.create({
      data: { email: input.email, passwordHash: hash, name: input.name, department: input.department },
    });
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  };

  AuthService.prototype.login = async function(input, ip) {
    var user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.isActive) throw new UnauthorizedError('Invalid credentials');
    var valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) {
      await this.audit(user.id, 'LOGIN_FAILED', 'auth', 'Invalid password', ip);
      throw new UnauthorizedError('Invalid credentials');
    }
    var tokenId = crypto.randomUUID();
    var family = crypto.randomUUID();
    var accessToken = signAccessToken({ sub: user.id, role: user.role, jti: tokenId });
    var refreshToken = signRefreshToken(user.id, tokenId);
    await prisma.refreshToken.create({ data: { tokenId: tokenId, userId: user.id, family: family } });
    await this.audit(user.id, 'LOGIN', 'auth', 'Login', ip);
    return { accessToken: accessToken, refreshToken: refreshToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  };

  AuthService.prototype.refresh = async function(token, ip) {
    var payload;
    try { payload = verifyRefreshToken(token); } catch(e) { throw new UnauthorizedError('Invalid token'); }
    var stored = await prisma.refreshToken.findUnique({ where: { tokenId: payload.tokenId } });
    if (!stored || stored.revokedAt) {
      if (stored) await prisma.refreshToken.updateMany({ where: { family: stored.family }, data: { revokedAt: new Date() } });
      throw new UnauthorizedError('Token reuse detected');
    }
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    var newId = crypto.randomUUID();
    var user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedError('User not active');
    var access = signAccessToken({ sub: user.id, role: user.role, jti: newId });
    var refresh = signRefreshToken(user.id, newId);
    await prisma.refreshToken.create({ data: { tokenId: newId, userId: user.id, family: stored.family } });
    return { accessToken: access, refreshToken: refresh };
  };

  AuthService.prototype.logout = async function(userId, refreshToken, jti) {
    if (refreshToken) {
      try {
        var p = verifyRefreshToken(refreshToken);
        await prisma.refreshToken.updateMany({ where: { userId: userId, tokenId: p.tokenId }, data: { revokedAt: new Date() } });
      } catch(e) {}
    }
    if (jti) await redis.set('blacklist:access:' + jti, '1', 'EX', 900);
    await this.audit(userId, 'LOGOUT', 'auth', 'Logout');
  };

  AuthService.prototype.getCurrentUser = async function(userId) {
    var user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');
    return { id: user.id, email: user.email, role: user.role };
  };

  AuthService.prototype.changePassword = async function(userId, input) {
    var user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');
    if (!await argon2.verify(user.passwordHash, input.currentPassword)) throw new BadRequestError('Wrong password');
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(input.newPassword) } });
    await this.audit(userId, 'PASSWORD_CHANGE', 'auth', 'Changed');
  };

  AuthService.prototype.forgotPassword = async function(email) {
    var user = await prisma.user.findUnique({ where: { email: email } });
    if (!user) return;
    var token = crypto.randomBytes(32).toString('hex');
    await redis.set('reset:' + token, user.id, 'EX', 3600);
    console.log('Reset token:', token);
  };

  AuthService.prototype.resetPassword = async function(input) {
    var userId = await redis.get('reset:' + input.token);
    if (!userId) throw new BadRequestError('Invalid token');
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(input.password) } });
    await redis.del('reset:' + input.token);
    await this.audit(userId, 'PASSWORD_RESET', 'auth', 'Reset');
  };

  AuthService.prototype.audit = async function(userId, action, resource, detail, ip) {
    await prisma.auditLog.create({ data: { userId: userId, action: action, resource: resource, detail: detail, ipAddress: ip } });
  };

  return AuthService;
})();

export var authService = new AuthService();\,

'src/modules/auth/auth.routes.ts': \import { authService } from './auth.service.js';
import { validateBody } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema } from './auth.schema.js';

export async function authRoutes(app) {
  app.post('/register', { preHandler: [validateBody(registerSchema)] }, async function(req, reply) {
    var r = await authService.register(req.body);
    reply.status(201).send({ success: true, data: r });
  });

  app.post('/login', { preHandler: [validateBody(loginSchema)] }, async function(req, reply) {
    var result = await authService.login(req.body, req.ip);
    reply.setCookie('access_token', result.accessToken, { httpOnly: true, secure: false, sameSite: 'strict', path: '/', maxAge: 900 });
    reply.setCookie('refresh_token', result.refreshToken, { httpOnly: true, secure: false, sameSite: 'strict', path: '/', maxAge: 604800 });
    reply.send({ success: true, data: { user: result.user } });
  });

  app.post('/refresh', async function(req, reply) {
    var t = (req.body && req.body.refreshToken) || req.cookies.refresh_token;
    if (!t) return reply.status(400).send({ success: false, message: 'Token required' });
    var tokens = await authService.refresh(t, req.ip);
    reply.setCookie('access_token', tokens.accessToken, { httpOnly: true, secure: false, sameSite: 'strict', path: '/', maxAge: 900 });
    reply.setCookie('refresh_token', tokens.refreshToken, { httpOnly: true, secure: false, sameSite: 'strict', path: '/', maxAge: 604800 });
    reply.send({ success: true });
  });

  app.post('/logout', { preHandler: [authenticate] }, async function(req, reply) {
    var jti;
    try { jti = JSON.parse(Buffer.from(req.cookies.access_token.split('.')[1], 'base64').toString()).jti; } catch(e) {}
    await authService.logout(req.user.id, req.cookies.refresh_token, jti);
    reply.clearCookie('access_token', { path: '/' });
    reply.clearCookie('refresh_token', { path: '/' });
    reply.send({ success: true });
  });

  app.get('/me', { preHandler: [authenticate] }, async function(req, reply) {
    var u = await authService.getCurrentUser(req.user.id);
    reply.send({ success: true, data: u });
  });

  app.put('/change-password', { preHandler: [authenticate, validateBody(changePasswordSchema)] }, async function(req, reply) {
    await authService.changePassword(req.user.id, req.body);
    reply.send({ success: true });
  });

  app.post('/forgot-password', { preHandler: [validateBody(forgotPasswordSchema)] }, async function(req, reply) {
    await authService.forgotPassword(req.body.email);
    reply.send({ success: true, message: 'If exists, email sent' });
  });

  app.post('/reset-password', { preHandler: [validateBody(resetPasswordSchema)] }, async function(req, reply) {
    await authService.resetPassword(req.body);
    reply.send({ success: true });
  });
}\,

'prisma/seed.ts': \ar prisma = require('../src/db/prisma.js').default;
var argon2 = require('argon2');

async function main() {
  var adminPwd = await argon2.hash('Admin@123!', { type: argon2.argon2id });
  var tlPwd = await argon2.hash('TL@123!', { type: argon2.argon2id });
  var empPwd = await argon2.hash('Employee@123!', { type: argon2.argon2id });

  await prisma.user.upsert({
    where: { email: 'admin@company.com' },
    update: {},
    create: { email: 'admin@company.com', name: 'System Admin', passwordHash: adminPwd, role: 'ADMIN', department: 'Engineering' },
  });

  await prisma.user.upsert({
    where: { email: 'tl@company.com' },
    update: {},
    create: { email: 'tl@company.com', name: 'Team Lead', passwordHash: tlPwd, role: 'TL', department: 'Product' },
  });

  await prisma.user.upsert({
    where: { email: 'employee@company.com' },
    update: {},
    create: { email: 'employee@company.com', name: 'John Doe', passwordHash: empPwd, role: 'EMPLOYEE', department: 'Product' },
  });

  console.log('Seeded users!');
}

main().catch(console.error).finally(function() { prisma.\(); });\,

'src/server.ts': \import Fastify from 'fastify';
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

async function buildApp() {
  var app = Fastify({
    logger: { level: 'debug', transport: { target: 'pino-pretty' } }
  });
  await app.register(helmet);
  await app.register(cors, { origin: true, credentials: true });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(cookie, { secret: config.CSRF_SECRET });
  await app.register(swagger, { openapi: { info: { title: 'TL Management API', version: '1.0.0' } } });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  app.setErrorHandler(errorHandler);
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.get('/api/v1/health', async function() { return { status: 'ok' }; });
  app.addHook('onClose', async function() { await disconnectDB(); });
  await connectDB();
  return app;
}

async function start() {
  var app = await buildApp();
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log('Server running on port ' + config.PORT);
  } catch(err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();\
};

// Write all files
Object.keys(files).forEach(function(filePath) {
  var dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, files[filePath], 'utf8');
  console.log('Created: ' + filePath);
});
