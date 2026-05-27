import { UnauthorizedError, ForbiddenError } from '../common/errors.js';
import { verifyAccessToken } from '../utils/jwt.js';
import redis from '../plugins/redis.js';
import { RoleHierarchy } from '../types/auth.js';

export async function authenticate(request, reply) {
  var token = request.cookies.access_token;
  if (!token) throw new UnauthorizedError('Access token missing');
  var payload;
  try { payload = verifyAccessToken(token); } catch(e) { throw new UnauthorizedError('Invalid token'); }
  try {
    var blacklisted = await redis.get('blacklist:access:' + payload.jti);
    if (blacklisted) throw new UnauthorizedError('Token revoked');
  } catch(e) { /* Redis unavailable, skip blacklist check */ }
  request.user = { id: payload.sub, role: payload.role, email: '' };
}

export function authorize() {
  var allowedRoles = Array.from(arguments);
  return async function(request, reply) {
    if (!request.user) throw new UnauthorizedError('Not authenticated');
    var has = allowedRoles.some(function(r) { return RoleHierarchy[request.user.role] >= RoleHierarchy[r]; });
    if (!has) throw new ForbiddenError('Insufficient permissions');
  };
}
