import jwt from 'jsonwebtoken';
import config from '../config/index.js';

export function signAccessToken(payload) {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, { expiresIn: config.JWT_ACCESS_EXPIRATION });
}

export function signRefreshToken(userId, tokenId) {
  return jwt.sign({ sub: userId, tokenId: tokenId }, config.JWT_REFRESH_SECRET, { expiresIn: config.JWT_REFRESH_EXPIRATION });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, config.JWT_REFRESH_SECRET);
}
