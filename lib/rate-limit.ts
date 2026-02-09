/**
 * Simple in-memory sliding-window rate limiter.
 *
 * On Vercel, Next.js middleware runs on the Edge Runtime — a long-lived
 * isolate per region — so the in-memory Map persists across requests
 * within the same instance.  It's not globally distributed, but it's a
 * meaningful first layer of protection.
 */

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

/** Evict stale entries every 5 minutes to prevent unbounded memory growth. */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    // If a bucket hasn't been touched in 10 minutes, drop it.
    if (now - bucket.lastRefill > 10 * 60 * 1000) {
      buckets.delete(key);
    }
  }
}

/**
 * Check whether a request should be allowed.
 *
 * Uses a token-bucket algorithm: each bucket holds up to `max` tokens and
 * refills at `max` tokens per `windowMs`.  Each allowed request consumes
 * one token.
 *
 * @returns `{ allowed: true }` or `{ allowed: false, retryAfterMs }`.
 */
export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now();
  cleanup(now);

  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: max - 1, lastRefill: now };
    buckets.set(key, bucket);
    return { allowed: true };
  }

  // Refill tokens based on elapsed time.
  const elapsed = now - bucket.lastRefill;
  const refill = (elapsed / windowMs) * max;
  bucket.tokens = Math.min(max, bucket.tokens + refill);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true };
  }

  // Time until at least one token is available.
  const retryAfterMs = Math.ceil(((1 - bucket.tokens) / max) * windowMs);
  return { allowed: false, retryAfterMs };
}
