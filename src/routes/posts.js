import { Router } from "express";
import { prisma, slowQuery } from "../db.js";
import { cached } from "../cache/cached.js";
import { invalidate, keys } from "../cache/invalidation.js";

const router = Router();

const FEED_TTL_S = 30;

router.get("/posts/feed", async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const sort = req.query.sort === "hot" ? "hot" : "new";

  const key = await keys.feed(page, sort);

  const feed = await cached(key, FEED_TTL_S, async () => {
    await slowQuery();
    return prisma.post.findMany({
      orderBy: sort === "hot" ? { likes: "desc" } : { createdAt: "desc" },
      skip: (page - 1) * 20,
      take: 20,
      include: { author: true },
    });
  });

  res.json(feed);
});

router.post("/posts", async (req, res) => {
  const post = await prisma.post.create({ data: req.body });
  await invalidate.onNewPost(post.authorId);
  res.status(201).json(post);
});

export default router;