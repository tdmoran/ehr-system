import { Request, Response, NextFunction } from 'express';

interface CacheEntry {
  body: unknown;
  statusCode: number;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = 30_000; // 30 seconds

/**
 * Simple in-memory response cache for GET requests.
 * Caches by URL + user ID to ensure per-user isolation.
 */
export function cacheResponse(ttlMs: number = DEFAULT_TTL_MS) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    const userId = (req as any).user?.id || 'anonymous';
    const key = `${userId}:${req.originalUrl}`;
    const entry = cache.get(key);

    if (entry && Date.now() - entry.timestamp < ttlMs) {
      return res.status(entry.statusCode).json(entry.body);
    }

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, {
          body,
          statusCode: res.statusCode,
          timestamp: Date.now(),
        });
      }
      return originalJson(body);
    };

    next();
  };
}

/**
 * Invalidate cache entries matching a prefix.
 * Call after mutations (POST, PUT, DELETE) to keep data fresh.
 */
export function invalidateCache(urlPrefix: string) {
  for (const key of cache.keys()) {
    // key format is "userId:url"
    const url = key.substring(key.indexOf(':') + 1);
    if (url.startsWith(urlPrefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Clear all cache entries. Useful for testing.
 */
export function clearCache() {
  cache.clear();
}

// Periodic cleanup of stale entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes max age
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > maxAge) {
      cache.delete(key);
    }
  }
}, 5 * 60 * 1000);
