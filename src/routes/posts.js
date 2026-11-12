
import { Router } from "express";
import { prisma, slowQuery } from "../db.js";
import { redis } from "../redis.js";
import { cached } from "../cache/cached.js";
import { invalidate } from "../cache/invalidation.js";

const router = Router();

// GET /posts/feed?page=1&sort=new|hot
router.get("/posts/feed", async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const sort = req.query.sort === "hot" ? "hot" : "new";

  // Include version, page, and sort in the cache key
  const version = (await redis.get("posts:feed:ver")) ?? "0";
  const key = `posts:feed:v${version}:page:${page}:sort:${sort}`;

  const feed = await cached(key, 60, async () => {
    await slowQuery();

    return prisma.post.findMany({
      orderBy:
        sort === "hot"
          ? { likes: "desc" }
          : { createdAt: "desc" },
      skip: (page - 1) * 20,
      take: 20,
      include: { author: true },
    });
  });

  res.json(feed);
});

// POST /posts
router.post("/posts", async (req, res) => {
  const post = await prisma.post.create({ data: req.body });

  // Invalidate all feed versions by incrementing the version
  await invalidate.onNewPost();

  res.status(201).json(post);
});

export default router;
