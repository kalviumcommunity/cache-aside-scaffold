import { redis } from "../redis.js";

/**
 * Invalidation rules — single source of truth.
 *
 * Feed invalidation strategy: VERSION COUNTER (no KEYS command).
 * ──────────────────────────────────────────────────────────────
 * Instead of building keys like "posts:feed:page:1:sort:new" and then
 * needing KEYS posts:feed:* to clear them all, we keep a version counter
 * at "posts:feed:version". Every feed cache key embeds the current version:
 *
 *     posts:feed:v<version>:page:<page>:sort:<sort>
 *
 * When a new post is created we INCR the version counter.  All old keys
 * (with the previous version number) become unreachable — no request will
 * ever ask for them again — and they self-expire via their TTL.
 *
 * This avoids the O(N) KEYS scan that blocks single-threaded Redis.
 */

// The key that holds the current feed version counter.
const FEED_VERSION_KEY = "posts:feed:version";

/**
 * Returns the current feed version (creating it at 1 if it doesn't exist).
 * Used by the route to build the cache key.
 */
export async function getFeedVersion() {
  const v = await redis.get(FEED_VERSION_KEY);
  if (v !== null) return v;
  // First time: initialise the counter at 1
  await redis.set(FEED_VERSION_KEY, "1");
  return "1";
}

/**
 * Builds a parameter-aware feed cache key that includes the version counter.
 * @param {number} page
 * @param {string} sort - "new" or "hot"
 * @returns {Promise<string>} e.g. "posts:feed:v3:page:1:sort:new"
 */
export async function feedCacheKey(page, sort) {
  const version = await getFeedVersion();
  return `posts:feed:v${version}:page:${page}:sort:${sort}`;
}

export const invalidate = {
  /**
   * Called after POST /posts — bumps the feed version counter so all
   * previously cached feed pages become unreachable (they expire via TTL).
   */
  onNewPost: async () => {
    await redis.incr(FEED_VERSION_KEY);
  },

  /**
   * Called after PUT /users/:id — deletes ONLY that user's cached profile.
   */
  onProfileEdit: async (userId) => {
    await redis.del(`users:${userId}`);
  },
};
