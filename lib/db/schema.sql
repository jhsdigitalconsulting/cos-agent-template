-- Idempotency ledger: one row per (provider, event_key) claims that event
-- exactly once. Insert-and-catch-unique-violation is the claim primitive
-- (see lib/db/ledger.ts) — never select-then-insert, since two concurrent
-- deliveries of the same event would both pass a select and both start a run.
CREATE TABLE IF NOT EXISTS event_ledger (
  provider   TEXT        NOT NULL,
  event_key  TEXT        NOT NULL,
  run_id     TEXT,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_key)
);

-- High-water mark per polling sync (for providers with no webhook, only a
-- pollable list endpoint). `cursor_value` is opaque to this table.
CREATE TABLE IF NOT EXISTS sync_cursors (
  provider     TEXT        PRIMARY KEY,
  cursor_value TEXT        NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Raw inbound webhook deliveries, logged before any parsing so a payload that
-- later fails to parse (a shape the handler didn't expect) is still captured
-- for replay/debugging rather than lost to a stack trace alone.
CREATE TABLE IF NOT EXISTS webhook_payloads (
  id          BIGSERIAL   PRIMARY KEY,
  provider    TEXT        NOT NULL,
  headers     JSONB       NOT NULL,
  body        TEXT        NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Outcome of processing a logged webhook delivery, filled in after the fact so
-- failures are queryable (the agent's list_webhook_failures tool) instead of
-- only visible in runtime logs.
ALTER TABLE webhook_payloads ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE webhook_payloads ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE webhook_payloads ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
