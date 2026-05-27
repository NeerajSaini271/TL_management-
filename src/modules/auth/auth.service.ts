import argon2 from 'argon2';
import crypto from 'crypto';
import pool from '../../db/pool.js';
import redis from '../../plugins/redis.js';
import { signAccessToken, signRefreshToken } from '../../utils/jwt.js';
import { UnauthorizedError, ConflictError, BadRequestError, NotFoundError } from '../../common/errors.js';
import { recordFailedAttempt, resetAttempts, isLocked } from '../../utils/lockout.js';
import { sanitize } from '../../utils/sanitize.js';
import { AnomalyDetector } from '../../utils/anomalyDetection.js';
import { ZeroKnowledgeVerifier } from '../../utils/zeroKnowledge.js';
import { Tokenizer } from '../../utils/tokenization.js';
import { CanaryToken } from '../../utils/canaryTokens.js';

export var AuthService = (function() {
  function AuthService() {}

  AuthService.prototype.register = async function(input) {
    var c = await pool.connect();
    try {
      var cleanEmail = sanitize(input.email).toLowerCase();
      var ex = await c.query("SELECT id FROM users WHERE email = $1", [cleanEmail]);
      if (ex.rows.length > 0) throw new ConflictError('Email exists');
      var hash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });
      var cleanName = sanitize(input.name);
      var r = await c.query("INSERT INTO users (email, password_hash, name, department) VALUES ($1,$2,$3,$4) RETURNING id, email, name, role", [cleanEmail, hash, cleanName, input.department || '']);
      Tokenizer.tokenize(cleanEmail);
      CanaryToken.deploy('user_registration', cleanEmail);
      return r.rows[0];
    } finally { c.release(); }
  };

  AuthService.prototype.login = async function(input, ip, userAgent) {
    var lockKey = (ip || 'unknown') + ':' + sanitize(input.email);
    if (isLocked(lockKey)) throw new UnauthorizedError('Account locked. Try later.');

    var c = await pool.connect();
    try {
      var cleanEmail = sanitize(input.email).toLowerCase();
      var r = await c.query("SELECT * FROM users WHERE email = $1 AND is_active = true", [cleanEmail]);
      if (r.rows.length === 0) { recordFailedAttempt(lockKey); throw new UnauthorizedError('Invalid credentials'); }
      var user = r.rows[0];
      var valid = await argon2.verify(user.password_hash, input.password);
      if (!valid) {
        var lockResult = recordFailedAttempt(lockKey);
        CanaryToken.trip('login_failure_' + user.id, { ip: ip, email: cleanEmail });
        if (lockResult.locked) throw new UnauthorizedError('Account locked for ' + lockResult.waitMinutes + ' minutes');
        throw new UnauthorizedError('Invalid credentials');
      }

      var anomaly = AnomalyDetector.recordLogin(String(user.id), ip || 'unknown', userAgent || 'unknown');
      if (anomaly.anomaly) {
        CanaryToken.trip('anomaly_' + user.id, { reasons: anomaly.reasons, score: anomaly.score, ip: ip });
        console.log('[SECURITY] Anomaly detected for ' + cleanEmail + ': ' + JSON.stringify(anomaly.reasons));
      }

      var zkp = ZeroKnowledgeVerifier.createChallenge();
      resetAttempts(lockKey);
      var tokenId = crypto.randomUUID();
      var accessToken = signAccessToken({ sub: String(user.id), role: user.role, jti: tokenId, zkp: zkp.challenge });
      var refreshToken = signRefreshToken(String(user.id), tokenId);
      await c.query("INSERT INTO refresh_tokens (token_id, user_id, family) VALUES ($1,$2,$3)", [tokenId, user.id, crypto.randomUUID()]);

      return {
        accessToken: accessToken,
        refreshToken: refreshToken,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, totpEnabled: user.totp_enabled },
        security: {
          anomalyScore: anomaly.score,
          anomalyDetected: anomaly.anomaly,
          anomalyReasons: anomaly.reasons,
          zkpChallenge: zkp.challenge,
          mlRisk: AnomalyDetector.simulateMLPrediction(String(user.id))
        }
      };
    } finally { c.release(); }
  };

  AuthService.prototype.getCurrentUser = async function(userId) {
    var c = await pool.connect();
    try {
      var r = await c.query("SELECT id, email, role, totp_enabled FROM users WHERE id = $1", [userId]);
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
      var hash = await argon2.hash(input.newPassword, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });
      await c.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, userId]);
    } finally { c.release(); }
  };

  AuthService.prototype.logout = async function(userId, rt, jti) {
    if (jti) { try { await redis.set('blacklist:access:' + jti, '1', 'EX', 900); } catch(e) {} }
  };

  AuthService.prototype.forgotPassword = async function(email) {
    var c = await pool.connect();
    try {
      var cleanEmail = sanitize(email).toLowerCase();
      var user = await c.query("SELECT id FROM users WHERE email = $1", [cleanEmail]);
      if (user.rows.length === 0) return;
      var token = crypto.randomBytes(32).toString('hex');
      try { await redis.set('reset:' + token, String(user.rows[0].id), 'EX', 3600); } catch(e) {}
      console.log('Reset token for ' + cleanEmail + ': ' + token);
    } finally { c.release(); }
  };

  AuthService.prototype.resetPassword = async function(input) {
    var userId = await redis.get('reset:' + input.token);
    if (!userId) throw new BadRequestError('Invalid token');
    var hash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });
    var c = await pool.connect();
    try { await c.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, userId]); await redis.del('reset:' + input.token); }
    finally { c.release(); }
  };

  AuthService.prototype.refreshToken = async function(token) {
    var c = await pool.connect();
    try {
      var parts = token.split('.');
      if (parts.length !== 3) throw new UnauthorizedError('Invalid token');
      var payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      var stored = await c.query("SELECT * FROM refresh_tokens WHERE token_id = $1 AND revoked_at IS NULL", [payload.tokenId]);
      if (stored.rows.length === 0) throw new UnauthorizedError('Token revoked');
      var newTokenId = crypto.randomUUID();
      var accessToken = signAccessToken({ sub: payload.sub, role: payload.role, jti: newTokenId });
      var refreshToken = signRefreshToken(payload.sub, newTokenId);
      return { accessToken, refreshToken };
    } finally { c.release(); }
  };

  return AuthService;
})();

export var authService = new AuthService();
