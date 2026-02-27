import { NextRequest } from "next/server";

type RateLimitBucket = {
  count: number;
  resetAtMs: number;
};

type RateLimitStore = {
  buckets: Map<string, RateLimitBucket>;
  lastSweepAtMs: number;
};

const globalForRateLimit = globalThis as unknown as { rateLimitStore?: RateLimitStore };

export type RateLimitRule = {
  keyPrefix: string;
  maxRequests: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAtMs: number;
};

function getStore(): RateLimitStore {
  if (globalForRateLimit.rateLimitStore) {
    return globalForRateLimit.rateLimitStore;
  }

  const store: RateLimitStore = {
    buckets: new Map(),
    lastSweepAtMs: 0,
  };
  globalForRateLimit.rateLimitStore = store;
  return store;
}

function getClientIdentifier(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const fromForwarded = forwardedFor?.split(",")[0]?.trim();
  const fromRealIp = req.headers.get("x-real-ip")?.trim();
  const fromCfIp = req.headers.get("cf-connecting-ip")?.trim();

  const ip = fromForwarded || fromRealIp || fromCfIp || "unknown";
  return ip || "unknown";
}

function sweepExpiredBuckets(store: RateLimitStore, nowMs: number): void {
  // Sweep at most once every 30s to keep memory bounded.
  if (nowMs - store.lastSweepAtMs < 30_000) {
    return;
  }

  for (const [key, bucket] of store.buckets.entries()) {
    if (bucket.resetAtMs <= nowMs) {
      store.buckets.delete(key);
    }
  }
  store.lastSweepAtMs = nowMs;
}

export function applyRateLimit(req: NextRequest, rule: RateLimitRule): RateLimitResult {
  const nowMs = Date.now();
  const store = getStore();
  sweepExpiredBuckets(store, nowMs);

  const identifier = getClientIdentifier(req);
  const key = `${rule.keyPrefix}:${identifier}`;
  const existing = store.buckets.get(key);

  const bucket =
    !existing || existing.resetAtMs <= nowMs
      ? { count: 0, resetAtMs: nowMs + rule.windowMs }
      : existing;

  if (bucket.count >= rule.maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAtMs - nowMs) / 1000));
    return {
      allowed: false,
      limit: rule.maxRequests,
      remaining: 0,
      retryAfterSeconds,
      resetAtMs: bucket.resetAtMs,
    };
  }

  bucket.count += 1;
  store.buckets.set(key, bucket);

  return {
    allowed: true,
    limit: rule.maxRequests,
    remaining: Math.max(0, rule.maxRequests - bucket.count),
    retryAfterSeconds: 0,
    resetAtMs: bucket.resetAtMs,
  };
}

export function buildRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(result.remaining),
    "x-ratelimit-reset": String(Math.ceil(result.resetAtMs / 1000)),
    ...(result.allowed ? {} : { "retry-after": String(result.retryAfterSeconds) }),
  };
}

