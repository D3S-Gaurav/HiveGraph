<p align="center">
  <img src="public/brand/hivegraph-logo.svg" width="320" alt="HiveGraph" />
</p>

# HiveGraph

[![CI](https://github.com/D3S-Gaurav/HiveGraph/actions/workflows/ci.yml/badge.svg)](https://github.com/D3S-Gaurav/HiveGraph/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

HiveGraph turns one complex goal into a graph of agent tasks and runs it live. A planner breaks the goal into a dependency graph, workers run independent tasks in parallel, a validator reviews each result and can send it back for revision, and a synthesizer merges the approved work into one answer. Every step streams to the browser as it happens, rendered with React Flow.

Around that core it has the pieces a real product needs: account sessions, Stripe billing, durable workflows on Temporal, an event log in Redis and Kafka, a Go telemetry service, and an MCP server for reading results from a terminal.

**Live demo:** [hivegraph.vercel.app](https://hivegraph.vercel.app)

## Contents

- [Features](#features)
- [How it works](#how-it-works)
- [Execution modes](#execution-modes)
- [Model selection](#model-selection)
- [Security boundaries](#security-boundaries)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Local setup](#local-setup)
- [Live event transport](#live-event-transport)
- [Plans and billing](#plans-and-billing)
- [Commands](#commands)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Planning.** An LLM planner turns the goal into a typed, dependency-aware task graph. Its structured output is validated with Zod before anything runs.
- **Parallel execution.** Tasks whose dependencies are met run at the same time instead of one after another.
- **Validation and revision.** A validator scores each result. A rejected result goes back to its worker with specific feedback; how many revisions are allowed depends on the mode.
- **Live research.** Researcher agents can run bounded web searches through Firecrawl and keep the source links. Without a Firecrawl key they say that live search is unavailable rather than inventing sources.
- **Live graph.** The execution graph updates as events arrive, over a WebSocket when the telemetry service is available and over SSE otherwise.
- **Accounts and billing.** Email and password sessions with Better Auth on PostgreSQL. Stripe Checkout, signed webhooks and the Customer Portal for the Pro plan.
- **Durable workflows.** In `temporal` mode, long runs move out of the HTTP request into a Temporal worker, with heartbeats, cancellation and recovery after a crash.
- **Telemetry service.** A separate Go service consumes the Kafka event stream and serves it over gRPC, a WebSocket and Prometheus metrics.
- **Image attachments.** Images are stored in Cloudinary as authenticated assets. A vision model turns them into a text description, and only that text enters the run.
- **MCP server.** A read-only, account-scoped MCP endpoint lets Codex or Claude Code list your runs and fetch their final Markdown deliverables.

## How it works

```text
Browser
  │ authenticated POST /api/swarm { goal, mode, attachments }
  ▼
Next.js route handler
  ├─ session, origin, input size and infrastructure checks
  ├─ plan lookup in PostgreSQL, then the user's quota in Redis
  ├─ text file ─────────────────────────────┐
  ├─ public GitHub repo → fixed GitHub API ─┤→ untrusted reference context
  ├─ image → authenticated Cloudinary asset ┘→ vision-derived text
  └─ starts the run (in process, or as a Temporal workflow)
          │
          ▼
planner → parallel workers → validator → synthesizer
          │                    │
          │                    ├─ models via OpenRouter and the Vercel AI SDK
          │                    └─ Zod validation of structured output
          ▼
Redis event stream ──SSE (fallback and durable replay)──▶ Zustand ──▶ React Flow
          │                                                            ▲
          └─ Kafka ──▶ Go telemetry consumer ──┬─▶ /metrics            │  Prometheus
                                               ├─▶ gRPC :9090          │  StreamRunEvents
                                               └─▶ wss://…/ws ─────────┘  preferred browser transport

Codex / Claude Code ──bearer token──▶ /api/mcp
                                      ├─ list_runs
                                      └─ get_final_deliverable
```

The planner, workers, validator and synthesizer are roles in the code, not separate servers. TypeScript decides their order and passes data between them; the model supplies the language work.

## Execution modes

Three modes trade speed and cost against depth:

| Mode | Tasks in the graph | Revisions allowed | Context budget | Best for |
|---|---:|---:|---|---|
| Low | 1–2 | 0 | smallest | quick, concise answers |
| Auto | 2–4 | up to 1 | balanced | everyday use |
| Max | 4–6 | up to 2 | largest | deep, multi-angle work |

Max is slower and costs more, but it is still bounded: every mode has fixed caps on how much text is passed between model calls.

### Context budgets

| Mode | Upstream handoff | Revision feedback | Worker to validator | Synthesis input |
|---|---:|---:|---:|---:|
| Low | 4,000 chars | 1,000 chars | 8,000 chars | 12,000 chars |
| Auto | 8,000 chars | 2,000 chars | 12,000 chars | 24,000 chars |
| Max | 16,000 chars | 4,000 chars | 24,000 chars | 48,000 chars |

- Each kind of repeated context has its own budget per mode.
- Labelled sections share a budget fairly, so one long worker output cannot crowd out the others.
- When text is trimmed, the section labels, opening and conclusion are kept and a truncation marker is added.
- Attachments are prepared once for planning and are not copied raw into every worker prompt.

## Model selection

Models are called through OpenRouter. Each role walks an ordered list of models and moves to the next on a rate limit or an unavailable model, so one failing model does not stop a run.

| OpenRouter key | Planner, validator, synthesizer | Workers |
|---|---|---|
| Has credit | Claude first, then the free pool | Free pool, to control cost |
| Free tier | Free pool | Free pool |

- The key's tier is checked once per process; nothing needs configuring to switch between the two rows.
- The free model lists are in [`src/lib/swarm/models.ts`](src/lib/swarm/models.ts). OpenRouter retires free models often, so update those ids if runs start failing on a free key.
- Any role can be pinned with `HIVEGRAPH_PLANNER_MODEL`, `HIVEGRAPH_VALIDATOR_MODEL`, `HIVEGRAPH_WORKER_MODEL`, `HIVEGRAPH_SYNTH_MODEL` or `HIVEGRAPH_VISION_MODEL`.
- A free-tier key has a daily request cap on OpenRouter's side, shared by everyone using the deployment.

## Security boundaries

- **Text files** are type-checked and size-limited, and treated as untrusted context for the planner.
- **GitHub attachments** accept only an exact public `https://github.com/owner/repository` URL. HiveGraph builds the `api.github.com` request itself, so users cannot make the server fetch an arbitrary host.
- **Images** are validated, stored with Cloudinary's `authenticated` delivery type, and described by a vision model instructed to treat any text in the image as data.
- **Raw image data** is never written to Redis, Kafka or Temporal. Only the derived text description enters the run.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, React Flow, Zustand, Tailwind CSS |
| Models | Vercel AI SDK, OpenRouter, Zod structured output |
| Auth | Better Auth (email and password, PostgreSQL sessions) |
| Billing | Stripe Checkout, webhooks, Customer Portal |
| Orchestration | Temporal (workflows, activities, heartbeats) |
| State | Redis (run state, event replay, rate limits in Lua) |
| Event stream | Kafka (versioned event envelopes, 6-partition topic) |
| Telemetry | Go (gRPC, WebSocket, Prometheus `/metrics`) |
| Media | Cloudinary (authenticated image storage) |
| Research | Firecrawl (bounded web search) |
| Database | PostgreSQL (users, sessions, billing state, MCP tokens) |
| Testing | Vitest; Go tests with `-race` |

## Repository layout

```text
src/
├── app/                   Next.js routes and pages
│   ├── api/               API routes: swarm, chat, billing, mcp, auth, health
│   └── sign-in/           Sign-in page
├── components/            React components (SwarmGraph, GoalBar, SidePanel, …)
├── lib/
│   ├── swarm/             Orchestration
│   │   ├── orchestrator.ts    runs the task graph
│   │   ├── planner.ts         turns the goal into tasks
│   │   ├── worker.ts          runs one specialist task
│   │   ├── validator.ts       reviews results
│   │   ├── bus.ts             event bus (Redis and Kafka)
│   │   ├── runStream.ts       client-side event stream handling
│   │   └── tokenBudget.ts     per-mode context limits
│   ├── billing/           plans, Stripe, entitlements
│   ├── mcp/               MCP server and token service
│   ├── media/             Cloudinary image storage
│   ├── research/          Firecrawl search
│   ├── auth.ts            authentication setup
│   └── store.ts           Zustand store
├── styles/                stylesheets (foundation, workspace, auth, …)
└── temporal/              Temporal workflow and worker

services/telemetry/        Go service: Kafka consumer serving gRPC, WebSocket and Prometheus
proto/telemetry/v1/        Protocol Buffer definitions for the gRPC API
scripts/                   database migrations and the Vercel build script
docs/                      architecture, design, product and deployment notes
```

## Local setup

### Prerequisites

- Node.js 22 (pinned in `package.json`; CI, Docker and Vercel all use 22)
- pnpm 11
- Docker, for Redis, PostgreSQL, Kafka and Temporal
- An OpenRouter API key
- Optional: a Firecrawl API key, for live web search

### Quick start

```bash
pnpm install

cp .env.example .env.local
# required: OPENROUTER_API_KEY, BETTER_AUTH_SECRET
# optional: FIRECRAWL_API_KEY, CLOUDINARY_*, STRIPE_*

pnpm infra:up          # start Redis, PostgreSQL, Kafka, Temporal and telemetry
pnpm db:migrate        # create the auth, billing and MCP tables
pnpm temporal:worker   # in a second terminal
pnpm dev               # http://localhost:3000
```

Generate an auth secret with `openssl rand -base64 32`.

**Upgrading from the Loom name:** every `LOOM_*` environment variable is now `HIVEGRAPH_*`, and the default Kafka topic is `hivegraph.swarm.events`. Rename the keys in your `.env.local`, then run `pnpm infra:up`. The Compose project is now called `hivegraph`, so it starts with fresh volumes and creates the topic and database under the new names.

### Local services

| Service | Address | Purpose |
|---|---|---|
| Next.js | `http://localhost:3000` | UI, auth, API, SSE and replay |
| Temporal UI | `http://localhost:8233` | inspect workflows |
| Telemetry HTTP | `http://localhost:9091/metrics` | Prometheus metrics and `/healthz` |
| Telemetry WebSocket | `ws://localhost:9091/ws` | live events for the browser |
| Telemetry gRPC | `localhost:9090` | `TelemetryService`, health, reflection |
| PostgreSQL | `localhost:5432` | users, sessions, billing |
| Redis | `localhost:6379` | run state, replay, rate limits |
| Kafka | `localhost:9092` | event stream |

## Live event transport

| `NEXT_PUBLIC_TELEMETRY_WS_URL` | Transport |
|---|---|
| set | WebSocket, falling back to SSE |
| empty | SSE only |

The graph header shows which transport is actually in use.

- **WebSocket** is preferred because it receives events straight from the Kafka fan-out, while SSE polls Redis every 150 ms.
- **SSE** is the fallback because Vercel's serverless functions cannot hold a socket open for a whole run, and some corporate proxies block WebSocket upgrades.
- **A durable Redis log** sits under both. Every frame carries an increasing `sequence` number; a gap triggers a replay from the Redis-backed endpoint, and a replayed event that was already applied is ignored.

The Go service reads each Kafka partition once and fans events out through an in-process hub. Each subscriber has a 256-event buffer and sends never block. A subscriber that fills its buffer is dropped instead of waited on, so one frozen browser tab cannot stall telemetry for everyone else.

## Plans and billing

| Plan | Runs per hour |
|---|---|
| Free | 3, including at most 1 in Max mode |
| Pro | 100 |

Limits are enforced atomically in Redis per user. Card details are handled entirely on Stripe's hosted pages and never reach this application.

<details>
<summary>Stripe setup</summary>

1. Create a Stripe product with a recurring price.
2. Set `STRIPE_SECRET_KEY` and `STRIPE_PRO_PRICE_ID`.
3. Add a webhook at `https://your-domain/api/billing/webhook` for these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Set the webhook's signing secret as `STRIPE_WEBHOOK_SECRET`.
5. Enable the Stripe Customer Portal and set `APP_URL`.

To test webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

</details>

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | start the development server |
| `pnpm typecheck` | TypeScript check |
| `pnpm lint` | ESLint |
| `pnpm test` | unit and integration tests |
| `pnpm db:migrate` | create or update the auth, billing and MCP tables |
| `pnpm infra:up` | start local dependencies |
| `pnpm infra:full` | start dependencies plus a containerised worker |
| `pnpm infra:topic` | describe the Kafka topic |
| `pnpm infra:logs` | follow infrastructure logs |
| `pnpm infra:down` | stop containers and keep their data |
| `pnpm infra:reset` | remove containers and their data |
| `go test -race ./...` | telemetry tests (run inside `services/telemetry`) |

CI runs on every push and pull request: a `web` job (lint, typecheck, and tests against a real Redis container) and a `telemetry` job (`go vet`, `go build`, `go test -race`).

## Deployment

The live demo runs option A below.

### Option A: web app only, on free tiers

Everything runs on Vercel plus three managed free-tier services. Runs execute inside the Vercel function (`direct` mode, capped at 300 seconds per run), and the graph streams over SSE.

| Component | Service used by the demo | Variables |
|---|---|---|
| Next.js | Vercel | `APP_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `HIVEGRAPH_EXECUTION_MODE=direct` |
| PostgreSQL | Neon | `DATABASE_URL` |
| Redis | Upstash (the `rediss://` TCP URL, not the REST URL) | `REDIS_URL` |
| Kafka | Aiven free tier with SASL enabled | `KAFKA_BROKERS`, `KAFKA_USERNAME`, `KAFKA_PASSWORD`, `KAFKA_SSL=1`, `KAFKA_SASL_MECHANISM=scram-sha-256`, `KAFKA_SWARM_EVENTS_TOPIC`, `KAFKA_CA_CERT` |
| Models | OpenRouter (a free-tier key works) | `OPENROUTER_API_KEY` |
| Billing | Stripe | `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` |

```bash
vercel link
vercel env add DATABASE_URL production   # repeat for each variable above
vercel deploy --prod
```

Things that are easy to get wrong:

- **Create the Kafka topic first.** `hivegraph.swarm.events` must exist before the first run; the app does not create it.
- **Aiven signs its SASL endpoint with a project CA.** Download the CA certificate from the Aiven console and set the full PEM as `KAFKA_CA_CERT`, or the connection fails with a self-signed certificate error.
- **The production build checks its environment.** `pnpm vercel-build` stops if a required variable is missing or `APP_URL` is not `https://`, then runs `pnpm db:migrate` before `next build`.
- **That check requires the Stripe variables.** Without a Stripe account, placeholder values let the build pass; everyone then stays on the Free plan and checkout is disabled.
- **Aiven powers off idle free services.** New runs are rejected until the Kafka service is turned back on.
- **`GET /api/health`** reports each dependency and is the quickest way to confirm a deployment is wired correctly.

### Option B: full stack

Vercel cannot host the Temporal worker or the Go service. Durable execution and the WebSocket transport need always-on containers:

| Component | Where |
|---|---|
| Next.js | Vercel, with `HIVEGRAPH_EXECUTION_MODE=temporal` |
| Temporal worker | a container service (`Dockerfile.temporal`) |
| Go telemetry | a container service (`render.yaml` blueprint) |
| PostgreSQL, Redis, Kafka | managed services |
| Temporal | Temporal Cloud or self-hosted |

See [docs/architecture.md](docs/architecture.md) and [docs/deployment.md](docs/deployment.md) for the full guides.

## Contributing

Bug reports and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md) for setup and the CI checks. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md), not in a public issue.

## License

MIT. See [LICENSE](LICENSE).
