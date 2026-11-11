import { Router } from "express";
import { prisma, slowQuery } from "../db.js";
import { cached } from "../cache/cached.js";
import { invalidate, feedCacheKey } from "../cache/invalidation.js";

const router = Router();

// READ (hot): GET /posts/feed?page=1&sort=new|hot
// TTL: 30 seconds — the feed changes frequently (new posts, trending shifts),
// but a brief staleness window is invisible to users and dramatically reduces
// DB load under high concurrency.
router.get("/posts/feed", async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const sort = req.query.sort === "hot" ? "hot" : "new";

  // Build a versioned, parameter-aware cache key
  const key = await feedCacheKey(page, sort);

  const feed = await cached(key, 30, async () => {
    await slowQuery(); // simulates a heavy, disk-backed query
    return prisma.post.findMany({
      orderBy: sort === "hot" ? { likes: "desc" } : { createdAt: "desc" },
      skip: (page - 1) * 20,
      take: 20,
      include: { author: true },
    });
  });

  res.json(feed);
});

// WRITE: POST /posts  { title, body, authorId }
// After creating the post, invalidate the cached feed via version bump.
router.post("/posts", async (req, res) => {
  const post = await prisma.post.create({ data: req.body });
  await invalidate.onNewPost();
  res.status(201).json(post);
});

export default router;
