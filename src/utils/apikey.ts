import crypto from 'crypto';

export function generateAPIKey(): { prefix: string; key: string; hash: string } {
  const key = crypto.randomBytes(32).toString('hex');
  const prefix = key.substring(0, 8);
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return { prefix, key, hash };
}

export function hashAPIKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateAPIPrefix(): string {
  return 'tl_' + crypto.randomBytes(4).toString('hex');
}
