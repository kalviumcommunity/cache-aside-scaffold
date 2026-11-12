
import { redis } from "../redis.js";

/**
 * cached(key, ttl, fetcher)
 * Cache-aside helper with stampede protection.
 */
export async function cached(key, ttl, fetcher) {

  // 1. Check Redis cache
  const cachedData = await redis.get(key);

  // 2. If cache HIT, return cached data
  if (cachedData !== null) {
    return JSON.parse(cachedData);
  }

  // 3. Try to acquire the lock
  const got = await redis.set("lock:" + key, "1", "NX", "EX", 5);

  if (got) {
    try {
      // 4. Fetch data from database
      const data = await fetcher();

      // 5. Store data in Redis with TTL
      await redis.set(key, JSON.stringify(data), "EX", ttl);

      // 6. Return fetched data
      return data;

    } finally {
      // 7. Release the lock
      await redis.del("lock:" + key);
    }

  } else {

    // 8. Wait for 50 milliseconds
    await new Promise(resolve => setTimeout(resolve, 50));

    // 9. Check Redis cache again
    const retryData = await redis.get(key);

    if (retryData !== null) {
      return JSON.parse(retryData);
    }

    // 10. Fallback to database
    return fetcher();
  }
}
