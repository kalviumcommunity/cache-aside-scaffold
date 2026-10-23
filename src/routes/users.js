import { Router } from "express";
import { prisma, slowQuery } from "../db.js";
import { cached } from "../cache/cached.js";
import { invalidate } from "../cache/invalidation.js";

const router = Router();

router.get("/users/:id", async (req, res, next) => {
  try {
    const userId = req.params.id;
    const key = `user:${userId}`;

    const user = await cached(key, 300, async () => {
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
  } catch (error) {
    next(error);
  }
});

router.put("/users/:id", async (req, res, next) => {
  try {
    const userId = req.params.id;

    const user = await prisma.user.update({
      where: { id: userId },
      data: req.body,
    });

    await invalidate.onProfileEdit(userId);

    res.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;