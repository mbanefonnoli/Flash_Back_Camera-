type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Per-instance and in-memory: on serverless this throttles one client against one
// warm instance, not a distributed flood. Swap in Redis if that stops being enough.
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  if (buckets.size > 10_000) {
    buckets.forEach((b, k) => {
      if (now > b.resetAt) buckets.delete(k);
    });
  }

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0].trim() || "unknown";
  return `${scope}:${ip}`;
}
