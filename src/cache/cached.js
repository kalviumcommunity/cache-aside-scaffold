import { redis } from "../redis.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function cached(key, ttl, fetcher) {
  const value = await redis.get(key);

  if (value !== null) {
    return JSON.parse(value);
  }

  const lockKey = "lock:" + key;
  const got = await redis.set(lockKey, "1", "NX", "EX", 5);

  if (got) {
    try {
      const cachedValue = await redis.get(key);

      if (cachedValue !== null) {
        return JSON.parse(cachedValue);
      }

      const result = await fetcher();

      await redis.set(key, JSON.stringify(result), "EX", ttl);

      return result;
    } finally {
      await redis.del(lockKey);
    }
  }

  await sleep(50);

  const cachedValue = await redis.get(key);

  if (cachedValue !== null) {
    return JSON.parse(cachedValue);
  }

  return fetcher();
}