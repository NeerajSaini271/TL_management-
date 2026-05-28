export class LeakyBucket {
  private buckets = new Map<string, { water: number; lastLeak: number }>();
  
  constructor(private capacity: number = 50, private leakRatePerSecond: number = 10) {}

  allow(key: string): { allowed: boolean; remaining: number; retryAfter?: number } {
    var now = Date.now();
    var bucket = this.buckets.get(key) || { water: 0, lastLeak: now };
    var elapsed = (now - bucket.lastLeak) / 1000;
    bucket.water = Math.max(0, bucket.water - elapsed * this.leakRatePerSecond);
    bucket.lastLeak = now;
    
    if (bucket.water < this.capacity) {
      bucket.water++;
      this.buckets.set(key, bucket);
      return { allowed: true, remaining: this.capacity - Math.floor(bucket.water) };
    }
    
    var retryAfter = Math.ceil((bucket.water - this.capacity + 1) / this.leakRatePerSecond);
    return { allowed: false, remaining: 0, retryAfter };
  }

  reset(key: string): void { this.buckets.delete(key); }
}

export var loginBucket = new LeakyBucket(50, 10);
export var apiBucket = new LeakyBucket(200, 20);
