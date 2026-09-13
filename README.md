# cos-agent-template

A reusable [eve](https://eve.dev) agent template: Slack integration via Vercel Connect, a Neon Postgres logging/idempotency layer, a centralized `withWebhookHandler()` wrapper, a generic Slack/Teams notifier, and a Skynest (Context Nest) MCP knowledge-vault connection — plus scripts to stand up a new client from scratch.

## Getting started

```bash
pnpm install
pnpm dev:eve
```

The development TUI opens an interactive session where you can send messages to your agent.

Start by editing `agent/instructions.md` to define the agent's identity, purpose, tone, and response guidelines. Configure its model and runtime behavior in `agent/agent.ts`.

## Setting up a new client

Run the full guided flow — it installs dependencies if needed, then walks through every step below in order, letting you skip any of them:

```bash
npx cos-agent-setup   # or: pnpm setup
```

Or run each step on its own (in this order) if you'd rather control the flow yourself:

1. `pnpm init:client` — interactively configures this repo: client display name, agent name, Vercel project names, Slack Connect connector slug, ops Slack channel, notification channels — and writes `.cos-client.json` (shared naming for the scripts below), `.env.local`, and updates `agent/instructions.md` / `app/layout.tsx` / `package.json`.
2. Create a dedicated GitHub repository for this client's agent (via `gh repo create ... --source=. --remote=origin --push`, or by hand) — `pnpm setup` prompts for this automatically and handles a pre-existing `origin` remote safely.
3. Point this repo at a Skynest (Context Nest) knowledge vault, either one the client already has (just give the guided flow its MCP URL) or a brand new one via `pnpm init:skynest` — which clones [`jhsdigitalconsulting/skynest`](https://github.com/jhsdigitalconsulting/skynest) as a sibling repo, generates its OAuth signing keypair, and walks you through the one manual step (registering a GitHub OAuth App) that can't be automated.
4. `pnpm setup:vercel` — links/creates the Vercel project(s), pushes environment variables, and provisions (or documents provisioning) the Neon database and, for Skynest, a Vercel Blob store.

## Core infrastructure

- **`lib/db/`** — Neon client (`client.ts`), idempotency ledger (`ledger.ts`), webhook payload logging (`webhook-log.ts`), polling cursors (`cursor.ts`). Schema lives in `lib/db/schema.sql`; apply it with `pnpm migrate`.
- **`lib/webhooks/handler.ts`** — `withWebhookHandler(provider, { verifySignature?, eventKey, handler })` wraps a route with: log the raw payload, verify its signature, claim it exactly once via the ledger, run your handler, and notify on failure. See the worked example at `app/api/hooks/example/route.ts`.
- **`lib/notifications/`** — a generic `NotificationChannel` interface with `SlackNotifier` and `TeamsNotifier` implementations, fanned out by `notify()` per the `NOTIFICATION_CHANNELS` env var.
- **`agent/connections/ctxnest.ts`** — MCP client connection to this client's Skynest vault.

## Learn more

- [eve documentation](https://eve.dev/docs)
- [Skynest](https://github.com/jhsdigitalconsulting/skynest)

## Deploy on Vercel

```bash
eve deploy
```

See the [eve deployment documentation](https://eve.dev/docs/guides/deployment/vercel) for authentication, environment variables, and deployment options, or use `pnpm setup:vercel` above.
