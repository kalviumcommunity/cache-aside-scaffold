import { Router } from "express";
import { prisma, slowQuery } from "../db.js";
import { cached } from "../cache/cached.js";
import { invalidate } from "../cache/invalidation.js";

const router = Router();

// READ: GET /users/:id
// TTL: 300 seconds (5 minutes) — user profiles change rarely (name/bio edits
// are infrequent), so a longer TTL is safe and cuts DB load substantially.
// Explicit invalidation on PUT /users/:id ensures immediate freshness on writes.
router.get("/users/:id", async (req, res) => {
  const userId = req.params.id;
  const key = `users:${userId}`;

  const user = await cached(key, 300, async () => {
    await slowQuery(); // simulates a heavy, disk-backed query
    return prisma.user.findUnique({
      where: { id: userId },
      include: { posts: true },
    });
  });

  if (!user) return res.status(404).json({ error: "not found" });
  res.json(user);
});

// WRITE: PUT /users/:id  { name?, bio? }
// After updating, invalidate ONLY this user's cached profile.
router.put("/users/:id", async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: req.body,
  });
  await invalidate.onProfileEdit(req.params.id);
  res.json(user);
});

export default router;
