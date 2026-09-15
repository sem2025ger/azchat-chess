'use strict';

/**
 * Lightweight in-memory per-socket token bucket rate limiter.
 * Does not depend on external libraries, makes no IP assumptions,
 * and leaves zero memory leaks after socket disconnection.
 */

class TokenBucket {
  constructor(capacity, refillRatePerSec) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRatePerSec;
    this.lastRefill = Date.now();
  }

  consume(cost = 1) {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;

    if (this.tokens >= cost) {
      this.tokens -= cost;
      return true;
    }
    return false;
  }
}

function createSocketRateLimiter() {
  const buckets = {
    // Normal rapid chess moves: capacity 10, refill rate 5 per sec (supports lightning bullet)
    move: new TokenBucket(10, 5),
    // Lobby events: join_queue, create/join private room: capacity 5, refill rate 1 per sec
    lobby: new TokenBucket(5, 1),
    // In-game actions: draw offer/accept/decline, resign: capacity 5, refill rate 1 per sec
    game_action: new TokenBucket(5, 1),
  };

  return {
    allow(actionCategory) {
      const bucket = buckets[actionCategory];
      if (!bucket) return true;
      return bucket.consume(1);
    },
  };
}

module.exports = {
  TokenBucket,
  createSocketRateLimiter,
};
