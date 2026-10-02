import { redis } from "../redis.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * cached(key, ttl, fetcher) — YOUR JOB.
 *
 * Turn this into a cache-aside helper WITH stampede protection.
 * Right now it does NO caching — it just runs the fetcher every time,
 * so the endpoints work but are slow and unprotected.
 *
 * Implement, in order:
 *   1. redis.get(key) — on a HIT, JSON.parse and return it (no DB).
 *   2. On a MISS, take a stampede lock so only ONE request does the work:
 *        const got = await redis.set("lock:" + key, "1", "NX", "EX", 5);
 *      - if got: run fetcher(), SET the key with an EX ttl, DEL the lock, return.
 *      - else (someone else holds the lock): sleep ~50ms, re-read the cache,
 *        return that (or fall back to fetcher() if still empty).
 *
 * The worked reference is the cached() helper from the lesson — study it,
 * then write your own here.
 */
export async function cached(key, ttl, fetcher) {
  // TODO: replace this naive passthrough with cache-aside + SET ... NX EX lock.
  // 1. cache-aside read. redis.get returns null on a miss; the string "null"
  //    is a cached null value (e.g. unknown user), so compare to null explicitly.
  const hit = await redis.get(key);
  if (hit !== null) return JSON.parse(hit);

  // 2. miss: try to become the single winner
  const lockKey = "lock:" + key;
  const won = await redis.set(lockKey, "1", "EX", 5, "NX");

  if (won) {
    try {
      const data = await fetcher();
      await redis.set(key, JSON.stringify(data ?? null), "EX", ttl);
      return data;
    } finally {
      await redis.del(lockKey); // release even if the fetcher threw
    }
  }

  // 3. losers: wait for the winner to fill the cache
  for (let i = 0; i < 100; i++) {
    await sleep(50);
    const again = await redis.get(key);
    if (again !== null) return JSON.parse(again);
  }
  return fetcher();
}
