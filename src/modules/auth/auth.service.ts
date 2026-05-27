import argon2 from 'argon2';
import crypto from 'crypto';
import pool from '../../db/pool.js';
import { signAccessToken, signRefreshToken } from '../../utils/jwt.js';
import { UnauthorizedError, ConflictError, BadRequestError, NotFoundError } from '../../common/errors.js';

export var AuthService = (function() {
  function AuthService() {}

  AuthService.prototype.register = async function(input) {
    var c = await pool.connect();
    try {
      var ex = await c.query("SELECT id FROM users WHERE email = $1", [input.email]);
      if (ex.rows.length > 0) throw new ConflictError('Email exists');
      var hash = await argon2.hash(input.password);
      var r = await c.query("INSERT INTO users (email, password_hash, name, department) VALUES ($1,$2,$3,$4) RETURNING id, email, name, role", [input.email, hash, input.name, input.department || '']);
      return r.rows[0];
    } finally { c.release(); }
  };

  AuthService.prototype.login = async function(input, ip) {
    var c = await pool.connect();
    try {
      var r = await c.query("SELECT * FROM users WHERE email = $1 AND is_active = true", [input.email]);
      if (r.rows.length === 0) throw new UnauthorizedError('Invalid credentials');
      var user = r.rows[0];
      var valid = await argon2.verify(user.password_hash, input.password);
      if (!valid) throw new UnauthorizedError('Invalid credentials');
      var tokenId = crypto.randomUUID();
      var accessToken = signAccessToken({ sub: String(user.id), role: user.role, jti: tokenId });
      var refreshToken = signRefreshToken(String(user.id), tokenId);
      await c.query("INSERT INTO refresh_tokens (token_id, user_id, family) VALUES ($1,$2,$3)", [tokenId, user.id, crypto.randomUUID()]);
      return { accessToken: accessToken, refreshToken: refreshToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
    } finally { c.release(); }
  };

  AuthService.prototype.getCurrentUser = async function(userId) {
    var c = await pool.connect();
    try {
      var r = await c.query("SELECT id, email, role FROM users WHERE id = $1", [userId]);
      if (r.rows.length === 0) throw new NotFoundError('User not found');
      return r.rows[0];
    } finally { c.release(); }
  };

  AuthService.prototype.changePassword = async function(userId, input) {
    var c = await pool.connect();
    try {
      var r = await c.query("SELECT password_hash FROM users WHERE id = $1", [userId]);
      if (r.rows.length === 0) throw new NotFoundError('User not found');
      var valid = await argon2.verify(r.rows[0].password_hash, input.currentPassword);
      if (!valid) throw new BadRequestError('Wrong password');
      var hash = await argon2.hash(input.newPassword);
      await c.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, userId]);
    } finally { c.release(); }
  };

  AuthService.prototype.logout = async function(userId, rt, jti) {};

  AuthService.prototype.forgotPassword = async function(email) {
    return;
  };

  AuthService.prototype.resetPassword = async function(input) {
    return;
  };

  AuthService.prototype.refreshToken = async function(token) {
    return { accessToken: '', refreshToken: '' };
  };

  return AuthService;
})();

export var authService = new AuthService();
