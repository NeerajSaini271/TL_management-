import { UnauthorizedError, ForbiddenError } from '../common/errors.js';
import { verifyAccessToken } from '../utils/jwt.js';
import redis from '../plugins/redis.js';
import { RoleHierarchy } from '../types/auth.js';

export async function authenticate(request: any, reply: any) {
  var token = request.cookies.access_token;
  if (!token) throw new UnauthorizedError('Access token missing');
  var payload: any;
  try { payload = verifyAccessToken(token); } catch(e) { throw new UnauthorizedError('Invalid token'); }
  try {
    var blacklisted = await redis.get('blacklist:access:' + payload.jti);
    if (blacklisted) throw new UnauthorizedError('Token revoked');
  } catch(e) { /* Redis down, skip */ }
  request.user = { id: payload.sub, role: payload.role, email: '' };
}

export function authorize(...allowedRoles: string[]) {
  return async function(request: any, reply: any) {
    if (!request.user) throw new UnauthorizedError('Not authenticated');
    var userRole = request.user.role;
    var has = allowedRoles.some(function(r) { return (RoleHierarchy as any)[userRole] >= (RoleHierarchy as any)[r]; });
    if (!has) throw new ForbiddenError('Insufficient permissions');
  };
}
