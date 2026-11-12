
import { Router } from "express";
import { prisma, slowQuery } from "../db.js";
import { cached } from "../cache/cached.js";
import { invalidate } from "../cache/invalidation.js";

const router = Router();

// GET /users/:id
router.get("/users/:id", async (req, res) => {
  const userId = req.params.id;

  const user = await cached(`user:${userId}`, 300, async () => {
    await slowQuery();

    return prisma.user.findUnique({
      where: { id: userId },
      include: { posts: true },
    });
  });

  if (!user) {
    return res.status(404).json({ error: "not found" });
  }

  res.json(user);
});

// PUT /users/:id
router.put("/users/:id", async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: req.body,
  });

  // Invalidate only this user's profile cache
  await invalidate.onProfileEdit(req.params.id);

  res.json(user);
});

export default router;
