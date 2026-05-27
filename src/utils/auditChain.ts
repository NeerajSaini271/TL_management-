import crypto from 'crypto';

export function calculateAuditHash(
  previousHash: string,
  userId: string | null,
  action: string,
  timestamp: string,
  detail: string
): string {
  const data = previousHash + userId + action + timestamp + detail;
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function verifyAuditChain(entries: any[]): boolean {
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const curr = entries[i];
    const expectedHash = calculateAuditHash(
      prev.chain_hash || '',
      curr.user_id,
      curr.action,
      curr.created_at,
      curr.detail || ''
    );
    if (expectedHash !== curr.chain_hash) return false;
  }
  return true;
}
