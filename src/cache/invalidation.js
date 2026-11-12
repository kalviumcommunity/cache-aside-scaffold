
import { redis } from "../redis.js";

/**
 * Cache invalidation rules — ONE source of truth.
 */

export const invalidate = {
  // Clear cached feed when a new post is created
  onNewPost: async () => {
    await redis.del("posts:feed");
  },

  // Clear only the edited user's cached profile
  onProfileEdit: async (userId) => {
    await redis.del(`profile:${userId}`);
  },
};
