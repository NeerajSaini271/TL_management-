export class CircuitBreaker {
  private state = 0; // 0=CLOSED, 1=OPEN, 2=HALF_OPEN
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  public name = '';

  constructor(name: string, failureThreshold = 20, resetTimeout = 15000, halfOpenMax = 3) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.halfOpenMax = halfOpenMax;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 1) {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 2;
      } else {
        throw new Error('Circuit breaker OPEN');
      }
    }
    try {
      var result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 0;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 1;
    }
  }
}
