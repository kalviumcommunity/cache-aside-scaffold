import { redis } from "../redis.js";

/**
 * invalidation rules — ONE source of truth. YOUR JOB.
 *
 * Every write that changes a cached read must DEL the key(s) it affects.
 * Keeping all the rules here (not scattered across controllers) is what
 * stops invalidation from drifting as the app grows.
 *
 * Wire these up so that:
 *   - creating a post  clears the cached feed
 *   - editing a user   clears THAT user's cached profile (only that one)
 *
 * NOTE on the feed: if your feed key includes params (page, sort), a single
 * `redis.del("posts:feed")` won't cover every page. Decide how to handle it
 * and write your reasoning in the README. DO NOT use `redis.keys("posts:feed:*")`
 * in production — KEYS blocks single-threaded Redis. Use one of:
 *   - a fixed, un-paginated feed key (simplest for this scaffold), or
 *   - a version counter in the key (INCR on write), or
 *   - an explicit dependency list of live feed keys.
 */
const FEED_VERSION = "posts:feed:version";

export const keys = {
  feed: async (page, sort) => {
    const v = (await redis.get(FEED_VERSION)) ?? "0";
    return `posts:feed:v${v}:page=${page}:sort=${sort}`;
  },
  user: (id) => `user:${id}`,
};

export const invalidate = {
  onNewPost: async () => {
    // TODO: DEL the cached feed key(s).
    await redis.incr(FEED_VERSION); // O(1), invalidates every page + sort
  },
  onProfileEdit: async (userId) => {
    // TODO: DEL only this user's cached profile key.
    await redis.del(keys.user(userId)); // only this user
  },
};
