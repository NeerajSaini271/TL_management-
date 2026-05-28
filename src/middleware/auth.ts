import { UnauthorizedError, ForbiddenError } from '../common/errors.js';
import { verifyAccessToken } from '../utils/jwt.js';
import redis from '../plugins/redis.js';
import { ZeroKnowledgeVerifier } from '../utils/zeroKnowledge.js';

var RoleHierarchy: any = { ADMIN: 4, MANAGER: 3, TL: 2, EMPLOYEE: 1 };

export async function authenticate(request: any, reply: any) {
  var token = request.cookies.access_token;
  if (!token) throw new UnauthorizedError('Access token missing');
  var payload: any;
  try { payload = verifyAccessToken(token); } catch(e) { throw new UnauthorizedError('Invalid token'); }

  try {
    var blacklisted = await redis.get('blacklist:access:' + payload.jti);
    if (blacklisted) throw new UnauthorizedError('Token revoked');
  } catch(e) {}

  // ZKP is optional - only verify if client sends response
  if (payload.zkp && request.headers['x-zkp-response']) {
    var valid = ZeroKnowledgeVerifier.verifyProof(payload.zkp, payload.zkp, request.headers['x-zkp-response']);
    if (!valid) throw new UnauthorizedError('Invalid ZKP response');
  }

  request.user = { id: payload.sub, role: payload.role, email: '' };
}

export function authorize(...allowedRoles: string[]) {
  return async function(request: any, reply: any) {
    if (!request.user) throw new UnauthorizedError('Not authenticated');
    var has = allowedRoles.some(function(r) { return (RoleHierarchy as any)[request.user.role] >= (RoleHierarchy as any)[r]; });
    if (!has) throw new ForbiddenError('Insufficient permissions');
  };
}
