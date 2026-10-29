/**
 * Counts requests per key in fixed windows, kept in the memory of the running server. It slows
 * down guessing, scraping and form flooding; a restarted or second server starts counting again,
 * which is acceptable for this size of service.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const maxBuckets = 5000;

export type RateResult = { allowed: boolean; retryAfterSeconds: number };

/** Counts one request for `key`; refused once more than `limit` arrive within `windowMs`. */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateResult {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= maxBuckets) {
      for (const [stale, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(stale);
      }
      if (buckets.size >= maxBuckets) buckets.clear();
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * The visitor's address. On Vercel the platform sets these headers itself, so a visitor cannot
 * choose them; elsewhere the first forwarded address is the best available.
 */
export function clientAddress(headers: Headers) {
  return (
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function resetRateLimits() {
  buckets.clear();
}
