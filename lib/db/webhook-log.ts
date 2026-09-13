import { sql } from "./client";

export type QueryFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

/** How a logged delivery ultimately resolved, recorded after the handler runs. */
export type WebhookLogOutcome = "handled" | "skipped" | "error";

export interface WebhookFailureSummary {
  id: number;
  provider: string;
  receivedAt: string;
  errorMessage: string | null;
}

export interface WebhookFailureDetail extends WebhookFailureSummary {
  headers: Record<string, unknown>;
  body: string;
}

function headersToObject(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

/**
 * Logs the raw request before any parsing, so a payload whose shape later
 * turns out not to match our assumptions is still captured for replay,
 * instead of being lost to a stack trace. Best-effort: a logging failure must
 * never break the webhook's own response, so insert failures are caught here
 * rather than propagated. Returns the new row's id (so the caller can record
 * an outcome on it later), or undefined if the insert itself failed.
 */
export async function logWebhookPayloadWith(
  query: QueryFn,
  provider: string,
  headers: Headers,
  rawBody: string,
): Promise<number | undefined> {
  try {
    const rows = (await query`
      INSERT INTO webhook_payloads (provider, headers, body)
      VALUES (${provider}, ${JSON.stringify(headersToObject(headers))}::jsonb, ${rawBody})
      RETURNING id
    `) as Array<{ id: number }>;
    return rows[0]?.id;
  } catch (error) {
    console.error(`failed to log ${provider} webhook payload`, error);
    return undefined;
  }
}

export function logWebhookPayload(provider: string, request: Request, rawBody: string): Promise<number | undefined> {
  return logWebhookPayloadWith(sql(), provider, request.headers, rawBody);
}

/**
 * Records how a logged delivery was ultimately handled. Same swallow-and-log
 * behavior as the insert above: recording the outcome must never break the
 * webhook's response either.
 */
export async function completeWebhookLogWith(
  query: QueryFn,
  id: number,
  outcome: WebhookLogOutcome,
  errorMessage?: string,
): Promise<void> {
  try {
    await query`
      UPDATE webhook_payloads
      SET outcome = ${outcome}, error_message = ${errorMessage ?? null}, completed_at = now()
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error(`failed to record outcome for webhook payload ${id}`, error);
  }
}

export function completeWebhookLog(id: number, outcome: WebhookLogOutcome, errorMessage?: string): Promise<void> {
  return completeWebhookLogWith(sql(), id, outcome, errorMessage);
}

/**
 * Failed deliveries, most recent first — the queue the agent's
 * `list_webhook_failures` tool reads when looking for something to repair.
 */
export async function listWebhookFailuresWith(query: QueryFn, provider?: string): Promise<WebhookFailureSummary[]> {
  const rows = (await (provider
    ? query`
        SELECT id, provider, received_at, error_message
        FROM webhook_payloads
        WHERE outcome = 'error' AND provider = ${provider}
        ORDER BY received_at DESC
      `
    : query`
        SELECT id, provider, received_at, error_message
        FROM webhook_payloads
        WHERE outcome = 'error'
        ORDER BY received_at DESC
      `)) as Array<{ id: number; provider: string; received_at: string; error_message: string | null }>;

  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    receivedAt: row.received_at,
    errorMessage: row.error_message,
  }));
}

export function listWebhookFailures(provider?: string): Promise<WebhookFailureSummary[]> {
  return listWebhookFailuresWith(sql(), provider);
}

export async function getWebhookFailureWith(query: QueryFn, id: number): Promise<WebhookFailureDetail | null> {
  const rows = (await query`
    SELECT id, provider, received_at, error_message, headers, body
    FROM webhook_payloads
    WHERE id = ${id}
  `) as Array<{
    id: number;
    provider: string;
    received_at: string;
    error_message: string | null;
    headers: Record<string, unknown>;
    body: string;
  }>;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    provider: row.provider,
    receivedAt: row.received_at,
    errorMessage: row.error_message,
    headers: row.headers,
    body: row.body,
  };
}

export function getWebhookFailure(id: number): Promise<WebhookFailureDetail | null> {
  return getWebhookFailureWith(sql(), id);
}
