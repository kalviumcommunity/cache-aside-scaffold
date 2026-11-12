import { redis } from "../redis.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LOCK_TTL_S = 5;
const POLL_MS = 50;
const MAX_POLLS = 40;

export async function cached(key, ttl, fetcher) {
  let hit;
  try {
    hit = await redis.get(key);
  } catch (e) {
    console.error("[cache] get failed, bypassing cache:", e.message);
    return fetcher();
  }
  if (hit !== null) return JSON.parse(hit);

  const lockKey = "lock:" + key;
  let won;
  try {
    won = await redis.set(lockKey, "1", "NX", "EX", LOCK_TTL_S);
  } catch (e) {
    console.error("[cache] lock failed, bypassing cache:", e.message);
    return fetcher();
  }

  if (won) {
    try {
      const value = await fetcher();
      if (value !== null && value !== undefined) {
        await redis.set(key, JSON.stringify(value), "EX", ttl);
      }
      return value;
    } finally {
      await redis.del(lockKey).catch(() => {});
    }
  }

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_MS);
    const v = await redis.get(key);
    if (v !== null) return JSON.parse(v);
    if (!(await redis.exists(lockKey))) break;
  }
  return fetcher();
}
