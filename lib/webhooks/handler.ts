import { claimEvent, releaseClaim } from "../db/ledger";
import { logWebhookPayload } from "../db/webhook-log";
import { notify } from "../notifications";

export interface WebhookOutcomeHandled {
  outcome: "handled";
  /** Extra fields merged into the 200 JSON response, e.g. { id: "..." }. */
  body?: Record<string, unknown>;
}

export interface WebhookOutcomeIgnored {
  outcome: "ignored";
  reason: string;
}

export type WebhookOutcome = WebhookOutcomeHandled | WebhookOutcomeIgnored;

export interface WebhookHandlerConfig {
  /**
   * Extracts the idempotency key for this delivery (e.g. a provider's event
   * id). Two deliveries with the same key run the handler at most once.
   */
  eventKey: (rawBody: string, request: Request) => string;
  /** Return false to reject the request with 401 before the handler runs. */
  verifySignature?: (rawBody: string, request: Request) => boolean | Promise<boolean>;
  handler: (rawBody: string, request: Request) => Promise<WebhookOutcome>;
}

/**
 * Wraps a webhook route with the log -> verify -> claim -> handle -> notify
 * sequence every provider route otherwise repeats by hand:
 *  1. Log the raw payload unconditionally, before verification, so a request
 *     that fails signature checks or later fails to parse is still captured.
 *  2. Verify the signature, if configured (401 on failure).
 *  3. Claim the event via the idempotency ledger (200 no-op if already
 *     claimed by a prior delivery).
 *  4. Run the handler; release the claim and notify on a thrown error, so a
 *     retried delivery isn't permanently locked out by a failed first attempt.
 */
export function withWebhookHandler(provider: string, config: WebhookHandlerConfig) {
  return async function handleWebhookRequest(request: Request): Promise<Response> {
    const rawBody = await request.text();
    await logWebhookPayload(provider, request, rawBody);

    if (config.verifySignature) {
      const verified = await config.verifySignature(rawBody, request);
      if (!verified) {
        return Response.json({ error: "invalid signature" }, { status: 401 });
      }
    }

    const eventKey = config.eventKey(rawBody, request);
    const claim = await claimEvent(provider, eventKey);
    if (!claim.claimed) {
      return Response.json({ outcome: "already-claimed" }, { status: 200 });
    }

    try {
      const result = await config.handler(rawBody, request);
      if (result.outcome === "handled") {
        return Response.json({ outcome: result.outcome, ...result.body }, { status: 200 });
      }
      return Response.json({ outcome: result.outcome, reason: result.reason }, { status: 200 });
    } catch (error) {
      await releaseClaim(provider, eventKey);
      const message = error instanceof Error ? error.message : String(error);
      await notify({
        level: "error",
        context: `${provider} webhook failed`,
        detail: message,
      });
      return Response.json({ error: "webhook handler failed" }, { status: 503 });
    }
  };
}
