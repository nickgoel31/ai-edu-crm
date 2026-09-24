import { NextResponse } from "next/server";

interface RateLimitRecord {
  timestamps: number[];
}

// In-memory store keyed by route + IP / identifier
const ipRequestStore = new Map<string, RateLimitRecord>();

// Cleanup stale records every 5 minutes to prevent memory leak
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

export interface RateLimitOptions {
  limit?: number;        // Maximum number of requests allowed in window
  windowMs?: number;     // Window duration in milliseconds (default: 60,000ms = 1 minute)
  identifier?: string;   // Optional custom identifier
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  response?: NextResponse;
}

/**
 * Extracts client IP or caller identity from Request headers
 */
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

/**
 * Checks rate limit for the given request and options.
 * Returns rate limit metadata and an optional pre-formatted 429 NextResponse.
 */
export function checkRateLimit(
  req: Request,
  routeKey: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const limit = options.limit ?? 60; // Default: 60 requests
  const windowMs = options.windowMs ?? 60 * 1000; // Default: 1 minute
  const now = Date.now();

  cleanupStaleEntries(windowMs);

  const ip = getClientIp(req);
  const identifier = options.identifier ? `:${options.identifier}` : "";
  const key = `${routeKey}:${ip}${identifier}`;

  let record = ipRequestStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    ipRequestStore.set(key, record);
  }

  // Filter timestamps within the current sliding window
  const windowStart = now - windowMs;
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= limit) {
    const oldestTimestamp = record.timestamps[0];
    const resetSeconds = Math.max(1, Math.ceil((oldestTimestamp + windowMs - now) / 1000));

    const response = NextResponse.json(
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

    return {
      allowed: false,
      limit,
      remaining: 0,
      resetSeconds,
      response,
    };
  }

  // Record this request timestamp
  record.timestamps.push(now);
  const remaining = limit - record.timestamps.length;
  const resetSeconds = Math.ceil(windowMs / 1000);

  return {
    allowed: true,
    limit,
    remaining,
    resetSeconds,
  };
}

/**
 * Reset rate limit cache (for testing purposes)
 */
export function resetRateLimits(): void {
  ipRequestStore.clear();
}
