### TTL reasoning

| Endpoint | TTL | Why (staleness tolerance) |
|---|---|---|
| `GET /posts/feed` | `30s` | New posts arrive constantly, so the feed is the data most likely to look stale. 30s keeps the endpoint off the DB while a missed update is only briefly visible. Writes also invalidate explicitly, so the TTL is mainly a safety net. |
| `GET /users/:id` | `300s` | Profiles rarely change, so a long TTL gives a high hit rate. `PUT /users/:id` deletes the key right away, so edits never wait for the TTL. |

### Invalidation rules

| Write | Clears |
|---|---|
| `POST /posts` | Every cached feed page (by bumping the feed version with `INCR posts:feed:version`), plus `user:<authorId>` because a profile embeds that user's posts. |
| `PUT /users/:id` | Only `user:<id>`. No other user's key is touched. |

All keys and rules live in `src/cache/invalidation.js`. Invalidation uses `DEL`/`INCR`, never "update the cache on write".

**How I handled the paginated feed (no `KEYS`):** a version counter in the key. Every feed key is `posts:feed:v<N>:page:<p>:sort:<s>`. `POST /posts` does one `INCR` on `posts:feed:version`, which makes every page/sort key unreachable at once (no scan, `KEYS` is never used). Old keys expire through the 30s TTL.

**Stampede protection:** on a miss, `cached()` takes `SET lock:<key> 1 NX EX 5`. The winner queries the DB, sets the value with the TTL and deletes the lock. Others sleep 50ms and re-read.

### Results (before -> after)

| Endpoint | req/s before | req/s after | p50 before -> after | p99 before -> after |
|---|---|---|---|---|
| `GET /posts/feed` | YOUR NUMBER | YOUR NUMBER | YOUR NUMBER | YOUR NUMBER |
| `GET /users/:id` | YOUR NUMBER | YOUR NUMBER | YOUR NUMBER | YOUR NUMBER |