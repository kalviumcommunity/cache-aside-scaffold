import { Router } from "express";
import { prisma, slowQuery } from "../db.js";
import { cached } from "../cache/cached.js";
import { invalidate, keys } from "../cache/invalidation.js";

const router = Router();

const USER_TTL_S = 300;

router.get("/users/:id", async (req, res) => {
  const id = req.params.id;
  const user = await cached(keys.user(id), USER_TTL_S, async () => {
    await slowQuery();
    return prisma.user.findUnique({
      where: { id },
      include: { posts: true },
    });
  });

  if (!user) return res.status(404).json({ error: "not found" });
  res.json(user);
});

router.put("/users/:id", async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: req.body,
  });
  await invalidate.onProfileEdit(req.params.id);
  res.json(user);
});

export default router;