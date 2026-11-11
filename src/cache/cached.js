import { redis } from "../redis.js";

/**
 * cached(key, ttl, fetcher) — Cache-aside with stampede protection.
 *
 * Flow:
 *   1. redis.get(key) → HIT → JSON.parse and return (no DB hit).
 *   2. MISS → attempt a stampede lock: SET "lock:<key>" "1" NX EX 5
 *      - Lock acquired (winner): run fetcher(), SET the result with EX ttl,
 *        DEL the lock, return the fresh data.
 *      - Lock NOT acquired (loser): sleep ~50 ms, re-read the cache.
 *        If still empty, fall back to fetcher() to avoid a deadlock.
 *
 * @param {string} key   - The Redis cache key (must be parameter-aware).
 * @param {number} ttl   - Time-to-live in seconds.
 * @param {function} fetcher - Async function that returns fresh data from the DB.
 * @returns {Promise<any>} Parsed cached value or freshly fetched data.
 */
export async function cached(key, ttl, fetcher) {
  // 1. Try the cache first
  const hit = await redis.get(key);
  if (hit !== null) {
    return JSON.parse(hit);
  }

  // 2. Cache miss — attempt stampede lock
  const lockKey = "lock:" + key;
  const gotLock = await redis.set(lockKey, "1", "NX", "EX", 5);

  if (gotLock) {
    // Winner: fetch from DB, populate cache, release lock
    try {
      const data = await fetcher();
      await redis.set(key, JSON.stringify(data), "EX", ttl);
      return data;
    } finally {
      // Always release the lock, even if fetcher throws
      await redis.del(lockKey);
    }
  }

  // Loser: someone else is fetching — wait and re-read
  await new Promise((resolve) => setTimeout(resolve, 50));

  const retry = await redis.get(key);
  if (retry !== null) {
    return JSON.parse(retry);
  }

  // Fallback: lock holder may have failed or be very slow — query DB directly
  // to avoid serving nothing to the user.
  return fetcher();
}
