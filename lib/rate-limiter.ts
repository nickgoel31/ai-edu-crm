import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

interface RateLimitRecord {
  timestamps: number[];
}

// In-memory store keyed by route + IP / identifier. This is the fallback
// backend, and the only one available with zero configuration — it works
// correctly for a single running instance, but each instance (and every
// redeploy) has its own independent counters, so it under-protects once
// you run more than one instance. Set UPSTASH_REDIS_REST_URL +
// UPSTASH_REDIS_REST_TOKEN to switch to the shared, persistent backend
// below, which is what actually holds up under horizontal scaling.
const ipRequestStore = new Map<string, RateLimitRecord>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupStaleEntries(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const expirationThreshold = now - windowMs * 2;
  ipRequestStore.forEach((record, key) => {
    record.timestamps = record.timestamps.filter((ts) => ts > expirationThreshold);
    if (record.timestamps.length === 0) {
      ipRequestStore.delete(key);
    }
  });
}

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redisClient = url && token ? new Redis({ url, token }) : null;
  return redisClient;
}

export interface RateLimitOptions {
  limit?: number; // Maximum number of requests allowed in window
  windowMs?: number; // Window duration in milliseconds (default: 60,000ms = 1 minute)
  identifier?: string; // Optional custom identifier
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  response?: NextResponse;
}

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }
  return "127.0.0.1";
}

function buildLimitedResponse(limit: number, resetSeconds: number): NextResponse {
  return NextResponse.json(
    {
      error: "Too Many Requests: Rate limit exceeded. Please try again later.",
      retryAfterSeconds: resetSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": resetSeconds.toString(),
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetSeconds.toString(),
      },
    }
  );
}

/** Fixed-window counter backed by Redis (INCR + PEXPIRE) — shared and
 * persistent across instances and redeploys. Slightly less precise than a
 * sliding window (bursts can straddle a window boundary), which is the
 * standard, acceptable trade-off for this kind of counter. */
async function checkRateLimitRedis(
  redis: Redis,
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.pexpire(key, windowMs);
  }
  const ttlMs = await redis.pttl(key);
  const resetSeconds = Math.max(1, Math.ceil((ttlMs > 0 ? ttlMs : windowMs) / 1000));

  if (count > limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetSeconds,
      response: buildLimitedResponse(limit, resetSeconds),
    };
  }

  return { allowed: true, limit, remaining: Math.max(0, limit - count), resetSeconds };
}

function checkRateLimitInMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  cleanupStaleEntries(windowMs);

  let record = ipRequestStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    ipRequestStore.set(key, record);
  }

  const windowStart = now - windowMs;
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= limit) {
    const oldestTimestamp = record.timestamps[0];
    const resetSeconds = Math.max(1, Math.ceil((oldestTimestamp + windowMs - now) / 1000));
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetSeconds,
      response: buildLimitedResponse(limit, resetSeconds),
    };
  }

  record.timestamps.push(now);
  const remaining = limit - record.timestamps.length;
  const resetSeconds = Math.ceil(windowMs / 1000);

  return { allowed: true, limit, remaining, resetSeconds };
}

/**
 * Checks rate limit for the given request and options. Uses the Redis
 * (Upstash) backend when UPSTASH_REDIS_REST_URL/TOKEN are configured —
 * the only backend that's actually correct once you run more than one
 * instance — and transparently falls back to the in-memory backend
 * otherwise (correct for a single instance, resets on redeploy).
 */
export async function checkRateLimit(
  req: Request,
  routeKey: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const limit = options.limit ?? 60;
  const windowMs = options.windowMs ?? 60 * 1000;
  const ip = getClientIp(req);
  const identifier = options.identifier ? `:${options.identifier}` : "";
  const key = `ratelimit:${routeKey}:${ip}${identifier}`;

  const redis = getRedis();
  if (redis) {
    try {
      return await checkRateLimitRedis(redis, key, limit, windowMs);
    } catch (err) {
      console.error("Redis rate limiter error, falling back to in-memory:", err);
    }
  }

  return checkRateLimitInMemory(key, limit, windowMs);
}

/** Reset rate limit cache (for testing purposes) — in-memory backend only. */
export function resetRateLimits(): void {
  ipRequestStore.clear();
}
