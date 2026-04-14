# PulseBoard — Embr Cache Template

A real-time dashboard showcasing Embr Cache (Valkey/Redis) features. Deploy it to [Embr](https://portal.embr.azure) with a single command and explore caching patterns through an interactive UI.

## Quick Start

```bash
embr login
embr quickstart deploy <owner>/embr-cache-template
```

Once deployed, open the environment URL shown in the output.

---

## Features

### 1. Leaderboard (Sorted Sets)

A ranked player leaderboard powered by Redis sorted sets (`ZADD`, `ZREVRANGE`, `ZINCRBY`).

- Add players with scores
- Boost scores with random increments
- Remove players
- Auto-refreshes every 3 seconds

### 2. Atomic Counters (INCR / SET)

Live counters for page views, API calls, cache hits, and errors using Redis `INCR` and `SET`.

- Increment any counter with one click
- Reset counters to zero
- Seeded with demo data on first run

### 3. Cache Explorer (GET / SETEX / TTL)

Set key-value pairs with a TTL and watch them expire in real time.

- **SET** a key with a value and TTL (1–3600 seconds, default 60)
- **GET** a key to see cache hit/miss status and remaining TTL
- Browse all live `demo:*` keys with their values and countdowns
- Flush all demo keys at once
- Auto-refreshes every 5 seconds

### 4. Cron Engine (TTL Triggers)

A cron job scheduler that uses **Valkey key expiration as the trigger mechanism** — no external scheduler needed.

**How it works:**

1. You create a job with a cron expression (e.g., `*/5 * * * *`) and an action
2. The server parses the cron expression and calculates seconds until the next fire
3. A Redis key (`cron:trigger:{id}`) is set with that TTL via `SETEX`
4. When the key expires, Valkey publishes a [keyspace notification](https://redis.io/docs/manual/keyspace-notifications/)
5. A dedicated subscriber connection receives the event and executes the job
6. The trigger key is immediately recreated with the TTL for the next cron match

**Supported actions:**

| Type | Description | Example |
|------|-------------|---------|
| HTTP | Makes a GET request to a URL | `https://example.com/webhook` |
| Script | Executes a shell command | `echo "hello"` |

**UI features:**

- Preset schedules (every minute, 5 min, 15 min, hourly, daily) or custom cron expressions
- Pause / resume individual jobs
- View execution logs with timestamp, duration, and success/failure status
- Delete jobs

**Cron expression format:** `minute hour day-of-month month day-of-week`

Supports `*`, ranges (`1-5`), steps (`*/5`), and lists (`1,3,5`).

### 5. Redis CLI (Interactive)

A terminal-style Redis client embedded in the browser.

- Execute any Redis command directly (e.g., `PING`, `KEYS *`, `INFO server`, `HGETALL cron:job:...`)
- Arrow-key command history (up/down)
- Type `CLEAR` to reset the output panel
- Dangerous commands are blocked server-side (`FLUSHALL`, `SHUTDOWN`, `CONFIG`, etc.)

---

## Cache Modes

Embr Cache supports two modes, configured in `embr.yaml`:

### Embedded Mode

```yaml
cache:
  enabled: true
  mode: "embedded"
  maxMemory: 128
  evictionPolicy: "allkeys-lru"
```

- Valkey runs **inside** your application's sandbox
- Connected via `redis://127.0.0.1:6379`
- Data is local to the instance — not shared across scaled instances
- Fastest latency (loopback network)
- Good for: single-instance apps, caching, development

### Managed Mode

```yaml
cache:
  enabled: true
  mode: "managed"
  maxMemory: 128
  evictionPolicy: "allkeys-lru"
```

- Valkey runs as a **separate managed service** provisioned by Embr
- Connected via a network endpoint (connection URL provided by the platform)
- Data is **shared across all instances** of the environment
- Survives instance restarts and redeployments
- Good for: multi-instance apps, shared state, production workloads

### Switching Modes

1. Edit `embr.yaml` and change `mode` to `"embedded"` or `"managed"`
2. Commit and push — Embr will redeploy with the new cache configuration
3. If switching to managed, Embr provisions a new cache instance during deployment (adds ~20s to deploy)

> **Note:** Switching modes creates a fresh cache — existing data does not migrate between modes.

---

## Configuration Reference

### `embr.yaml`

```yaml
platform: nodejs
platformVersion: "20"
autoDeploy: true

run:
  port: 3000
  startCommand: node server/index.js

cache:
  enabled: true
  mode: "managed"          # "embedded" or "managed"
  maxMemory: 128           # Max memory in MB
  evictionPolicy: "allkeys-lru"  # Valkey eviction policy

static:
  spaFallback: true
  headers:
    "*.js": "public, max-age=31536000, immutable"
    "*.css": "public, max-age=31536000, immutable"

healthCheck:
  path: /health
```

### Cache Options

| Option | Values | Description |
|--------|--------|-------------|
| `enabled` | `true` / `false` | Enable or disable the cache |
| `mode` | `"embedded"` / `"managed"` | Cache deployment mode (see above) |
| `maxMemory` | Integer (MB) | Maximum memory allocation |
| `evictionPolicy` | `allkeys-lru`, `volatile-lru`, `noeviction`, etc. | What happens when memory is full |

### Environment Variable

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis/Valkey connection URL (auto-set by Embr) |

---

## Project Structure

```
├── embr.yaml                 # Embr deployment configuration
├── package.json
├── vite.config.js             # Vite build config with API proxy
├── client/
│   ├── index.html
│   └── src/
│       ├── main.jsx           # React entry point
│       ├── App.jsx            # Main app: Counters, Leaderboard, CacheExplorer
│       ├── CronJobs.jsx       # Cron engine UI
│       ├── RedisCli.jsx       # Interactive Redis CLI
│       └── styles.css
└── server/
    ├── index.js               # Express server entry point
    ├── cache/
    │   └── index.js           # Redis connections (primary + subscriber)
    ├── cron/
    │   ├── parser.js          # 5-field cron expression parser
    │   └── engine.js          # Keyspace notification listener + job executor
    ├── middleware/
    │   └── errorHandler.js
    └── routes/
        ├── health.js
        ├── leaderboard.js     # Sorted set operations
        ├── counters.js        # Atomic counter operations
        ├── cacheDemo.js       # GET/SETEX/TTL demo
        ├── cron.js            # Cron job CRUD API
        ├── redisCli.js        # Redis CLI API (safe command execution)
        └── stats.js           # Redis server stats
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/stats` | Redis server memory and connection stats |
| GET/POST | `/api/leaderboard` | List / add players |
| POST | `/api/leaderboard/:name/increment` | Boost a player's score |
| DELETE | `/api/leaderboard/:name` | Remove a player |
| GET/POST | `/api/counters` | List / manage counters |
| POST | `/api/cache-demo/set` | Set a key with TTL |
| GET | `/api/cache-demo/get/:key` | Get a key (shows hit/miss) |
| GET | `/api/cache-demo/keys` | List all demo keys |
| POST | `/api/cache-demo/flush` | Delete all demo keys |
| GET | `/api/cron` | List cron jobs |
| POST | `/api/cron` | Create a cron job |
| POST | `/api/cron/:id/toggle` | Pause / resume a job |
| DELETE | `/api/cron/:id` | Delete a job |
| GET | `/api/cron/:id/logs` | Get execution log |
| POST | `/api/redis-cli` | Execute a Redis command |

---

## Tech Stack

- **Runtime:** Node.js 20, Express
- **Cache:** Valkey/Redis via [ioredis](https://github.com/redis/ioredis)
- **Frontend:** React 18, Vite
- **Platform:** [Embr](https://portal.embr.azure)
