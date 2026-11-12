import { redis } from "../redis.js";

export async function cached(key, ttl, fetcher) {
  // 1. Check Redis first
  const cachedData = await redis.get(key);

  if (cachedData !== null) {
    return JSON.parse(cachedData);
  }

  // 2. Try to acquire the lock
  const lockKey = "lock:" + key;
  const gotLock = await redis.set(lockKey, "1", "NX", "EX", 5);

  // 3. Lock winner fetches from database
  if (gotLock) {
    try {
      const data = await fetcher();

      await redis.set(key, JSON.stringify(data), "EX", ttl);

      return data;
    } finally {
      await redis.del(lockKey);
    }
  }

  // 4. Other requests wait and check the cache again
  await new Promise(resolve => setTimeout(resolve, 50));

  const data = await redis.get(key);

  if (data !== null) {
    return JSON.parse(data);
  }

  // 5. Fallback if the cache is still empty
  return fetcher();
}