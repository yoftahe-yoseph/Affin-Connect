import type { NextFunction, Request, Response } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export function extractClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    const firstHop = forwarded.split(',')[0]?.trim();
    if (firstHop) return firstHop;
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    const firstHop = forwarded[0]?.split(',')[0]?.trim();
    if (firstHop) return firstHop;
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function createRateLimiter(options: RateLimitOptions) {
  const windowMs = Math.max(1000, Math.floor(options.windowMs));
  const maxRequests = Math.max(1, Math.floor(options.maxRequests));
  const keyPrefix = options.keyPrefix ? `${options.keyPrefix}:` : '';
  const buckets = new Map<string, number[]>();

  function pruneStaleBuckets(nowMs: number) {
    if (buckets.size < 500) return;
    const cutoff = nowMs - windowMs;
    for (const [k, timestamps] of buckets.entries()) {
      const fresh = timestamps.filter((ts) => ts > cutoff);
      if (fresh.length === 0) {
        buckets.delete(k);
      } else {
        buckets.set(k, fresh);
      }
    }
  }

  function check(rawKey: string, nowMs: number = Date.now()): RateLimitCheckResult {
    pruneStaleBuckets(nowMs);
    const key = `${keyPrefix}${rawKey || 'unknown'}`;
    const cutoff = nowMs - windowMs;
    const existing = buckets.get(key) ?? [];
    const active = existing.filter((ts) => ts > cutoff);

    if (active.length >= maxRequests) {
      buckets.set(key, active);
      const oldestActive = active[0] ?? nowMs;
      const retryMs = Math.max(1000, oldestActive + windowMs - nowMs);
      return {
        allowed: false,
        limit: maxRequests,
        remaining: 0,
        retryAfterSeconds: Math.ceil(retryMs / 1000),
      };
    }

    active.push(nowMs);
    buckets.set(key, active);
    return {
      allowed: true,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - active.length),
      retryAfterSeconds: 0,
    };
  }

  function middleware(req: Request, res: Response, next: NextFunction) {
    const ip = extractClientIp(req);
    const result = check(ip);
    res.setHeader('X-RateLimit-Limit', String(result.limit));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));

    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      return res.status(429).json({
        error: 'Too many requests. Please slow down and try again shortly.',
        retryAfterSeconds: result.retryAfterSeconds,
      });
    }

    return next();
  }

  function reset() {
    buckets.clear();
  }

  return { check, middleware, reset };
}
