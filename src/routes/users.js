import { Router } from "express";
import { prisma, slowQuery } from "../db.js";
import { cached } from "../cache/cached.js";
import { invalidate, keys } from "../cache/invalidation.js";

const router = Router();
const USER_TTL = 300; // seconds: profiles rarely change

// READ: GET /users/:id
// TODO: wrap the DB read in cached(key, ttl, fetcher).
//   - Key MUST include the :id path param.
//   - Choose a TTL (seconds) and justify it in the README.
router.get("/users/:id", async (req, res) => {
  const user = await cached(keys.user(req.params.id), USER_TTL, async () => {
    await slowQuery(); // simulates a heavy, disk-backed query
    return prisma.user.findUnique({
      where: { id: req.params.id },
      include: { posts: true },
    });
  });

  if (!user) return res.status(404).json({ error: "not found" });
  res.json(user);
});

// WRITE: PUT /users/:id  { name?, bio? }
// TODO: after updating, invalidate ONLY this user's cached profile.
router.put("/users/:id", async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: req.body,
  });
  await invalidate.onProfileEdit(req.params.id);
  res.json(user);
});

export default router;
