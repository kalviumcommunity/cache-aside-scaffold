# Cache-Aside + Stampede Protection — 2-Endpoint Scaffold

A small **Express + Prisma** service with two read-heavy endpoints and two write endpoints that affect them. This implementation uses Redis cache-aside with TTLs, explicit invalidation, and stampede protection.

The service runs on SQLite and uses an artificial query delay (`SLOW_MS`, default 40ms) to demonstrate the performance benefit of caching.

## The endpoints

| Endpoint | Kind | Affected by |
|---|---|---|
| `GET /posts/feed?page=&sort=new\|hot` | Read (hot) | `POST /posts` |
| `GET /users/:id` | Read | `PUT /users/:id` |
| `POST /posts` | Write | Invalidates the feed |
| `PUT /users/:id` | Write | Invalidates that user's profile |

## Implementation

- Implemented `cached(key, ttl, fetcher)` using Redis cache-aside.
- Cache hits return the parsed JSON value without querying the database.
- Cache misses use `SET lock:<key> 1 NX EX 5` to reduce duplicate work.
- The lock holder fetches the data, stores it with a TTL, and releases the lock.
- Requests that do not acquire the lock wait approximately 50ms, then recheck the cache.
- Feed cache keys include the feed version, page number, and sort order.
- User profile cache keys include the user ID.

## TTL reasoning

| Endpoint | TTL | Why |
|---|---:|---|
| `GET /posts/feed` | 60 seconds | Feed data can change frequently. A short TTL limits staleness while allowing repeated reads to be served from Redis. |
| `GET /users/:id` | 300 seconds | Profiles generally change less frequently, so a five-minute TTL reduces repeated database reads. Profile updates explicitly invalidate the affected user's cache. |

## Invalidation rules

| Write | Clears |
|---|---|
| `POST /posts` | Increments the `posts:feed:ver` counter so subsequent feed requests use a new cache-key version. |
| `PUT /users/:id` | Deletes only `user:<id>` for the updated profile. |

### How I handled the paginated feed (no `KEYS`)

I used a Redis version counter, `posts:feed:ver`. The feed cache key contains the current version, page number, and sort order, for example `posts:feed:v0:page:1:sort:new`.

When a new post is created, the version counter is incremented. Subsequent requests use the new version, so old feed entries are no longer used. This avoids calling `KEYS posts:feed:*`, which can block Redis while scanning keys. Old entries expire through their TTL.

## Verification

Command:

```bash
AUTHOR_ID=cmvkvbny00000ug1l7oe2mlkz npm run verify
```

Result:

- PASS: feed fresh after first write
- PASS: feed fresh after second write (invalidation works)

## Results (before → after)

Load test command:

```bash
node scripts/load.js /posts/feed 50 2000
```

| Endpoint | req/s before | req/s after | p50 before → after | p99 before → after |
|---|---:|---:|---|---|
| `GET /posts/feed` | 824 | 3,807 | 58.2ms → 10.4ms | 120.9ms → 50.9ms |
| `GET /users/:id` | Not measured | Not measured | Not measured | Not measured |

The feed test showed approximately **4.62× the throughput**, with p50 latency decreasing by approximately **82.1%** and p99 latency decreasing by approximately **57.9%**. These measurements are from the recorded load-test runs; results can vary between runs.

## Setup

```bash
npm install
docker start redis-m4
cp .env.example .env
npm run db:push
npm run seed
npm start
```

## Submit

Open a pull request from your fork containing the cache helper, cached read routes, invalidation rules, and completed README. Include the verification result and measured load-test results in the submission.