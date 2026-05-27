import crypto from 'crypto';

var tokenVault = new Map<string, { original: string; token: string; created: number; expires: number }>();
var masterKey = crypto.randomBytes(32).toString('hex');

export class Tokenizer {
  static tokenize(data: string, ttlMinutes: number = 60): string {
    var existing = Array.from(tokenVault.entries()).find(function(e: any) { return e[1].original === data; });
    if (existing && existing[1].expires > Date.now()) {
      return existing[1].token;
    }

    var token = 'tok_' + crypto.createHmac('sha256', masterKey).update(data + Date.now()).digest('hex').substring(0, 32);
    tokenVault.set(token, {
      original: data,
      token: token,
      created: Date.now(),
      expires: Date.now() + ttlMinutes * 60000
    });
    return token;
  }

  static detokenize(token: string): string | null {
    var entry = tokenVault.get(token);
    if (!entry || entry.expires < Date.now()) {
      tokenVault.delete(token);
      return null;
    }
    return entry.original;
  }

  static rotateMasterKey(): string {
    masterKey = crypto.randomBytes(32).toString('hex');
    tokenVault.clear();
    return masterKey;
  }
}
