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

  AuthService.prototype.register = async function(input: any) {
    var c = await pool.connect();
    try {
      var cleanEmail = sanitize(input.email).toLowerCase();
      var existing = await c.query("SELECT id FROM users WHERE email = '" + cleanEmail + "'");
      if (existing.rows.length > 0) throw new ConflictError('Email already registered');
      var hash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });
      var cleanName = sanitize(input.name);
      var cleanDept = input.department ? sanitize(input.department) : '';
      var tokenizedEmail = Tokenizer.tokenize(cleanEmail);
      var r = await c.query("INSERT INTO users (email, password_hash, name, department) VALUES ('" + cleanEmail + "','" + hash + "','" + cleanName + "','" + cleanDept + "') RETURNING id, email, name, role");
      CanaryToken.deploy('user_registration', cleanEmail);
      return r.rows[0];
    } finally { c.release(); }
  };

  AuthService.prototype.login = async function(input: any, ip?: string, userAgent?: string) {
    var lockKey = (ip || 'unknown') + ':' + sanitize(input.email);
    if (isLocked(lockKey)) {
      throw new UnauthorizedError('Account temporarily locked. Try again later.');
    }

    var c = await pool.connect();
    try {
      var cleanEmail = sanitize(input.email).toLowerCase();
      var r = await c.query("SELECT * FROM users WHERE email = '" + cleanEmail + "' AND is_active = true");
      if (r.rows.length === 0) {
        recordFailedAttempt(lockKey);
        throw new UnauthorizedError('Invalid credentials');
      }
      var user = r.rows[0];
      var valid = await argon2.verify(user.password_hash, input.password);
      if (!valid) {
        var lockResult = recordFailedAttempt(lockKey);
        CanaryToken.trip('login_failure_' + user.id, { ip, email: cleanEmail });
        if (lockResult.locked) {
          throw new UnauthorizedError('Account locked for ' + lockResult.waitMinutes + ' minutes');
        }
        throw new UnauthorizedError('Invalid credentials');
      }

      // Anomaly detection
      var anomaly = AnomalyDetector.recordLogin(String(user.id), ip || 'unknown', userAgent || 'unknown');
      if (anomaly.anomaly) {
        CanaryToken.trip('anomaly_' + user.id, { reasons: anomaly.reasons, score: anomaly.score, ip });
        console.log('[ANOMALY] Suspicious login for ' + cleanEmail + ': ' + JSON.stringify(anomaly));
      }

      // ZKP challenge-response
      var zkp = ZeroKnowledgeVerifier.createChallenge();
      
      resetAttempts(lockKey);
      var tokenId = crypto.randomUUID();
      var accessToken = signAccessToken({ sub: String(user.id), role: user.role, jti: tokenId, zkp: zkp.challenge });
      var refreshToken = signRefreshToken(String(user.id), tokenId);
      await c.query("INSERT INTO refresh_tokens (token_id, user_id, family) VALUES ('" + tokenId + "'," + user.id + ",'" + crypto.randomUUID() + "')");
      
      return {
        accessToken: accessToken,
        refreshToken: refreshToken,
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          role: user.role, 
          totpEnabled: user.totp_enabled 
        },
        security: {
          anomalyScore: anomaly.score,
          anomalyDetected: anomaly.anomaly,
          zkpChallenge: zkp.challenge,
          mlRisk: AnomalyDetector.simulateMLPrediction(String(user.id))
        }
      };
    } finally { c.release(); }
  };

  AuthService.prototype.refreshToken = async function(token: string) {
    var c = await pool.connect();
    try {
      var parts = token.split('.');
      if (parts.length !== 3) throw new UnauthorizedError('Invalid token');
      var payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      var stored = await c.query("SELECT * FROM refresh_tokens WHERE token_id = '" + payload.tokenId + "' AND revoked_at IS NULL");
      if (stored.rows.length === 0) {
        await c.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE family = (SELECT family FROM refresh_tokens WHERE token_id = '" + payload.tokenId + "')");
        throw new UnauthorizedError('Token reuse detected - all sessions revoked');
      }
      await c.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = " + stored.rows[0].id);
      
      var newTokenId = crypto.randomUUID();
      var user = await c.query("SELECT * FROM users WHERE id = " + payload.sub + " AND is_active = true");
      if (user.rows.length === 0) throw new UnauthorizedError('User not active');
      
      var accessToken = signAccessToken({ sub: String(user.rows[0].id), role: user.rows[0].role, jti: newTokenId });
      var refreshToken = signRefreshToken(String(user.rows[0].id), newTokenId);
      await c.query("INSERT INTO refresh_tokens (token_id, user_id, family) VALUES ('" + newTokenId + "'," + user.rows[0].id + ",'" + stored.rows[0].family + "')");
      
      return { accessToken, refreshToken };
    } finally { c.release(); }
  };

  AuthService.prototype.getCurrentUser = async function(userId: any) {
    var c = await pool.connect();
    try {
      var r = await c.query("SELECT id, email, role, totp_enabled FROM users WHERE id = " + userId);
      if (r.rows.length === 0) throw new NotFoundError('User not found');
      var profile = AnomalyDetector.getProfile(String(userId));
      return { ...r.rows[0], anomalyProfile: profile };
    } finally { c.release(); }
  };

  AuthService.prototype.changePassword = async function(userId: any, input: any) {
    var c = await pool.connect();
    try {
      var r = await c.query("SELECT password_hash FROM users WHERE id = " + userId);
      if (r.rows.length === 0) throw new NotFoundError('User not found');
      var valid = await argon2.verify(r.rows[0].password_hash, input.currentPassword);
      if (!valid) throw new BadRequestError('Current password is incorrect');
      var hash = await argon2.hash(input.newPassword, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });
      await c.query("UPDATE users SET password_hash = '" + hash + "', updated_at = NOW() WHERE id = " + userId);
    } finally { c.release(); }
  };

  AuthService.prototype.logout = async function(userId: any, refreshToken?: string, jti?: string) {
    if (refreshToken) {
      var c = await pool.connect();
      try {
        var parts = refreshToken.split('.');
        if (parts.length === 3) {
          var payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          await c.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_id = '" + payload.tokenId + "'");
        }
      } catch(e) {} finally { c.release(); }
    }
    if (jti) {
      try { await redis.set('blacklist:access:' + jti, '1', 'EX', 900); } catch(e) {}
    }
  };

  AuthService.prototype.forgotPassword = async function(email: string) {
    var c = await pool.connect();
    try {
      var cleanEmail = sanitize(email).toLowerCase();
      var user = await c.query("SELECT id FROM users WHERE email = '" + cleanEmail + "'");
      if (user.rows.length === 0) return;
      var token = crypto.randomBytes(32).toString('hex');
      try { await redis.set('reset:' + token, String(user.rows[0].id), 'EX', 3600); } catch(e) {}
      console.log('Reset token for ' + cleanEmail + ': ' + token);
    } finally { c.release(); }
  };

  AuthService.prototype.resetPassword = async function(input: any) {
    var userId = await redis.get('reset:' + input.token);
    if (!userId) throw new BadRequestError('Invalid or expired reset token');
    var hash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });
    var c = await pool.connect();
    try {
      await c.query("UPDATE users SET password_hash = '" + hash + "', updated_at = NOW() WHERE id = " + userId);
      await redis.del('reset:' + input.token);
    } finally { c.release(); }
  };

  return AuthService;
})();

export var authService = new AuthService();
