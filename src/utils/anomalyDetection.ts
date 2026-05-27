import crypto from 'crypto';

interface BehaviorProfile {
  avgLoginTime: number;
  loginTimes: number[];
  commonIPs: Map<string, number>;
  geoPattern: string[];
  deviceFingerprints: string[];
  requestVelocity: number;
  anomalyScore: number;
}

var profiles = new Map<string, BehaviorProfile>();

export class AnomalyDetector {
  static recordLogin(userId: string, ip: string, userAgent: string, timestamp: number = Date.now()): { anomaly: boolean; score: number; reasons: string[] } {
    var profile = profiles.get(userId) || {
      avgLoginTime: timestamp,
      loginTimes: [],
      commonIPs: new Map(),
      geoPattern: [],
      deviceFingerprints: [],
      requestVelocity: 0,
      anomalyScore: 0
    };

    var reasons: string[] = [];
    var score = 0;

    // IP reputation check
    var ipCount = profile.commonIPs.get(ip) || 0;
    if (ipCount === 0 && profile.commonIPs.size > 2) {
      score += 30;
      reasons.push('New IP address');
    }
    profile.commonIPs.set(ip, ipCount + 1);

    // Device fingerprint change
    var deviceHash = crypto.createHash('md5').update(userAgent).digest('hex');
    if (profile.deviceFingerprints.length > 0 && !profile.deviceFingerprints.includes(deviceHash)) {
      score += 25;
      reasons.push('New device fingerprint');
    }
    if (!profile.deviceFingerprints.includes(deviceHash)) {
      profile.deviceFingerprints.push(deviceHash);
    }

    // Time-based anomaly
    var hour = new Date(timestamp).getHours();
    if (hour >= 1 && hour <= 5) {
      score += 15;
      reasons.push('Unusual login time (1-5 AM)');
    }

    // Velocity check
    profile.loginTimes.push(timestamp);
    if (profile.loginTimes.length > 5) {
      profile.loginTimes = profile.loginTimes.slice(-5);
      var recentLogins = profile.loginTimes.filter(function(t) { return timestamp - t < 60000; });
      if (recentLogins.length > 3) {
        score += 40;
        reasons.push('High login velocity');
      }
    }

    profile.anomalyScore = score;
    profiles.set(userId, profile);

    return {
      anomaly: score > 50,
      score: score,
      reasons: reasons
    };
  }

  static getProfile(userId: string): BehaviorProfile | null {
    return profiles.get(userId) || null;
  }

  static simulateMLPrediction(userId: string): { risk: string; confidence: number } {
    var profile = profiles.get(userId);
    if (!profile) return { risk: 'UNKNOWN', confidence: 0 };
    if (profile.anomalyScore > 70) return { risk: 'CRITICAL', confidence: 0.95 };
    if (profile.anomalyScore > 50) return { risk: 'HIGH', confidence: 0.85 };
    if (profile.anomalyScore > 30) return { risk: 'MEDIUM', confidence: 0.75 };
    return { risk: 'LOW', confidence: 0.9 };
  }
}
