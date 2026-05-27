import argon2 from 'argon2';
import crypto from 'crypto';
import prisma from '../../db/prisma.js';
import redis from '../../plugins/redis.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { UnauthorizedError, ConflictError, BadRequestError, NotFoundError } from '../../common/errors.js';

export var AuthService = (function() {
  function AuthService() {}

  AuthService.prototype.register = async function(input) {
    var existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictError('Email exists');
    var hash = await argon2.hash(input.password);
    var user = await prisma.user.create({ data: { email: input.email, passwordHash: hash, name: input.name, department: input.department } });
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  };

  AuthService.prototype.login = async function(input, ip) {
    var user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.isActive) throw new UnauthorizedError('Invalid credentials');
    var valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) throw new UnauthorizedError('Invalid credentials');
    var tokenId = crypto.randomUUID();
    var accessToken = signAccessToken({ sub: user.id, role: user.role, jti: tokenId });
    var refreshToken = signRefreshToken(user.id, tokenId);
    await prisma.refreshToken.create({ data: { tokenId: tokenId, userId: user.id, family: crypto.randomUUID() } });
    return { accessToken: accessToken, refreshToken: refreshToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  };

  AuthService.prototype.getCurrentUser = async function(userId) {
    var user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');
    return { id: user.id, email: user.email, role: user.role };
  };

  AuthService.prototype.changePassword = async function(userId, input) {
    var user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');
    var valid = await argon2.verify(user.passwordHash, input.currentPassword);
    if (!valid) throw new BadRequestError('Current password is incorrect');
    var hash = await argon2.hash(input.newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
  };

  AuthService.prototype.logout = async function(userId, refreshToken, jti) {
    if (jti) {
      try { await redis.set('blacklist:access:' + jti, '1', 'EX', 900); } catch(e) {}
    }
  };

  AuthService.prototype.forgotPassword = async function(email) {
    var user = await prisma.user.findUnique({ where: { email: email } });
    if (!user) return;
    var token = crypto.randomBytes(32).toString('hex');
    try { await redis.set('reset:' + token, user.id, 'EX', 3600); } catch(e) {}
    console.log('Reset token:', token);
  };

  return AuthService;
})();

export var authService = new AuthService();
