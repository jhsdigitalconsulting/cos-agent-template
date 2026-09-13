import { sql } from "./client";

export type QueryFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

function headersToObject(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

/**
 * Logs the raw request before any parsing, so a payload whose shape later
 * turns out not to match our assumptions (like the Calendly event_type bug)
 * is still captured for replay, instead of being lost to a stack trace.
 * Best-effort: a logging failure must never break the webhook's own response,
 * same reasoning as alertFailure.
 */
export async function logWebhookPayloadWith(
  query: QueryFn,
  provider: string,
  headers: Headers,
  rawBody: string,
): Promise<void> {
  try {
    await query`
      INSERT INTO webhook_payloads (provider, headers, body)
      VALUES (${provider}, ${JSON.stringify(headersToObject(headers))}::jsonb, ${rawBody})
    `;
  } catch (error) {
    console.error(`failed to log ${provider} webhook payload`, error);
  }
}

export function logWebhookPayload(provider: string, request: Request, rawBody: string): Promise<void> {
  return logWebhookPayloadWith(sql(), provider, request.headers, rawBody);
}
