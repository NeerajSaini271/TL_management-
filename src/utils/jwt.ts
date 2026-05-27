import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import type { JwtPayload } from '../types/auth.js';

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRATION as any,
    jwtid: crypto.randomUUID(),
  });
}

export function signRefreshToken(userId: string, tokenId: string): string {
  return jwt.sign({ sub: userId, tokenId }, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRATION as any,
    jwtid: tokenId,
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.JWT_ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload & { tokenId: string } {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as JwtPayload & { tokenId: string };
}
