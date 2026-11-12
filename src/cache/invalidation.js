import { redis } from "../redis.js";

const FEED_VERSION_KEY = "posts:feed:version";

export const keys = {
  feed: async (page, sort) => {
    const v = (await redis.get(FEED_VERSION_KEY)) ?? "0";
    return `posts:feed:v${v}:page:${page}:sort:${sort}`;
  },
  user: (id) => `user:${id}`,
};

export const invalidate = {
  onNewPost: async (authorId) => {
    await redis.incr(FEED_VERSION_KEY);
    if (authorId) await redis.del(keys.user(authorId));
  },
  onProfileEdit: async (userId) => {
    await redis.del(keys.user(userId));
  },
};