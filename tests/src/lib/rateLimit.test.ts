import {
  applyRateLimit,
  buildRateLimitHeaders,
  type RateLimitRule,
} from "@/src/lib/rateLimit";

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/test", { headers }) as never;
}

describe("rateLimit", () => {
  const rule: RateLimitRule = {
    keyPrefix: "test",
    maxRequests: 2,
    windowMs: 60_000,
  };

  beforeEach(() => {
    delete (globalThis as { rateLimitStore?: unknown }).rateLimitStore;
  });

  test("allows first request and decrements remaining", () => {
    const result = applyRateLimit(
      makeRequest({ "x-real-ip": "198.51.100.1" }),
      rule
    );
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(2);
    expect(result.remaining).toBe(1);
  });

  test("blocks requests after maxRequests is reached", () => {
    const req = makeRequest({ "x-real-ip": "198.51.100.2" });
    const first = applyRateLimit(req, rule);
    const second = applyRateLimit(req, rule);
    const third = applyRateLimit(req, rule);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  test("isolates counters by keyPrefix", () => {
    const req = makeRequest({ "x-real-ip": "198.51.100.3" });
    const firstRule: RateLimitRule = { keyPrefix: "faq", maxRequests: 1, windowMs: 60_000 };
    const secondRule: RateLimitRule = {
      keyPrefix: "feedback",
      maxRequests: 1,
      windowMs: 60_000,
    };

    const firstPass = applyRateLimit(req, firstRule);
    const secondPass = applyRateLimit(req, secondRule);

    expect(firstPass.allowed).toBe(true);
    expect(secondPass.allowed).toBe(true);
  });

  test("uses x-forwarded-for as the primary client identifier", () => {
    const req = makeRequest({
      "x-forwarded-for": "203.0.113.10, 10.0.0.5",
      "x-real-ip": "198.51.100.10",
      "cf-connecting-ip": "192.0.2.10",
    });

    const first = applyRateLimit(req, { keyPrefix: "proxy", maxRequests: 1, windowMs: 60_000 });
    const second = applyRateLimit(req, { keyPrefix: "proxy", maxRequests: 1, windowMs: 60_000 });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
  });

  test("buildRateLimitHeaders includes retry-after only when blocked", () => {
    const allowedHeaders = buildRateLimitHeaders({
      allowed: true,
      limit: 2,
      remaining: 1,
      retryAfterSeconds: 0,
      resetAtMs: Date.now() + 10_000,
    });
    const blockedHeaders = buildRateLimitHeaders({
      allowed: false,
      limit: 2,
      remaining: 0,
      retryAfterSeconds: 10,
      resetAtMs: Date.now() + 10_000,
    });

    expect(allowedHeaders["retry-after"]).toBeUndefined();
    expect(blockedHeaders["retry-after"]).toBe("10");
    expect(blockedHeaders["x-ratelimit-limit"]).toBe("2");
    expect(blockedHeaders["x-ratelimit-remaining"]).toBe("0");
  });
});
