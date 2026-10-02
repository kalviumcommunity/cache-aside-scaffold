import { Router } from "express";
import { prisma, slowQuery } from "../db.js";
import { cached } from "../cache/cached.js";
import { invalidate } from "../cache/invalidation.js";

const router = Router();
const FEED_TTL = 30; // seconds: feed changes fast


// READ (hot): GET /posts/feed?page=1&sort=new|hot
// TODO: wrap the DB read in cached(key, ttl, fetcher).
//   - Build a PARAMETER-AWARE key from page + sort.
//   - Choose a TTL (seconds) and justify it in the README.
router.get("/posts/feed", async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const sort = req.query.sort === "hot" ? "hot" : "new";

  const key = await keys.feed(page, sort);
  const feed = await cached(key, FEED_TTL, async () => {
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
// TODO: after creating the post, invalidate the cached feed.
router.post("/posts", async (req, res) => {
  const post = await prisma.post.create({ data: req.body });
  await invalidate.onNewPost();
  res.status(201).json(post);
});

export default router;
