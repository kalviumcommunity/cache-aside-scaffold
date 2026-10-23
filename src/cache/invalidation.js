import { redis } from "../redis.js";

export const invalidate = {
  onNewPost: async () => {
    await redis.incr("posts:feed:ver");
  },

  onProfileEdit: async (userId) => {
    await redis.del(`user:${userId}`);
  },
};