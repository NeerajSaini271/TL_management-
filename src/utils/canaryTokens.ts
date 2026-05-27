import crypto from 'crypto';

var canaryRegistry = new Map<string, { created: number; triggered: boolean; alertData: any }>();

export class CanaryToken {
  static deploy(type: string, resource: string): { token: string; id: string } {
    var id = crypto.randomUUID();
    var token = 'ct_' + crypto.randomBytes(24).toString('hex');
    canaryRegistry.set(id, {
      created: Date.now(),
      triggered: false,
      alertData: { type, resource, deployedAt: new Date().toISOString() }
    });
    return { token, id };
  }

  static trip(id: string, context: any = {}): { alert: boolean; data: any } {
    var canary = canaryRegistry.get(id);
    if (!canary) return { alert: false, data: null };
    canary.triggered = true;
    canary.alertData = { ...canary.alertData, ...context, trippedAt: new Date().toISOString() };
    console.log('[SECURITY ALERT] Canary tripped:', JSON.stringify(canary.alertData));
    return { alert: true, data: canary.alertData };
  }

  static verify(id: string): { active: boolean; triggered: boolean } {
    var canary = canaryRegistry.get(id);
    if (!canary) return { active: false, triggered: false };
    return { active: true, triggered: canary.triggered };
  }

  static getRegistry(): any[] {
    return Array.from(canaryRegistry.entries()).map(function(e: any) {
      return { id: e[0], ...e[1] };
    });
  }
}
