import { Router } from "express";
import { prisma, slowQuery } from "../db.js";
import { cached } from "../cache/cached.js";
import { invalidate } from "../cache/invalidation.js";
import { redis } from "../redis.js";

const router = Router();

router.get("/posts/feed", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const sort = req.query.sort === "hot" ? "hot" : "new";
    const version = (await redis.get("posts:feed:ver")) ?? "0";
    const key = `posts:feed:v${version}:page:${page}:sort:${sort}`;

    const feed = await cached(key, 60, async () => {
      await slowQuery();

      return prisma.post.findMany({
        orderBy: sort === "hot" ? { likes: "desc" } : { createdAt: "desc" },
        skip: (page - 1) * 20,
        take: 20,
        include: { author: true },
      });
    });

    res.json(feed);
  } catch (error) {
    next(error);
  }
});

router.post("/posts", async (req, res, next) => {
  try {
    const post = await prisma.post.create({ data: req.body });
    await invalidate.onNewPost();
    res.status(201).json(post);
  } catch (error) {
    next(error);
  }
});

export default router;