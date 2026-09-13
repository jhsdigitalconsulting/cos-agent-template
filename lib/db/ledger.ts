import { sql } from "./client";

export interface ClaimedResult {
  claimed: true;
}

export interface NotClaimedResult {
  claimed: false;
  runId: string | null;
}

export type ClaimResult = ClaimedResult | NotClaimedResult;

export type QueryFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

export function isUniqueViolation(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === "23505";
}

/**
 * Insert-and-catch, never select-then-insert: two concurrent deliveries of the
 * same order would both pass a select and both start a run.
 */
export async function claimEventWith(
  query: QueryFn,
  provider: string,
  eventKey: string,
): Promise<ClaimResult> {
  try {
    await query`INSERT INTO event_ledger (provider, event_key) VALUES (${provider}, ${eventKey})`;
    return { claimed: true };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const rows = (await query`
      SELECT run_id FROM event_ledger WHERE provider = ${provider} AND event_key = ${eventKey}
    `) as Array<{ run_id: string | null }>;
    return { claimed: false, runId: rows[0]?.run_id ?? null };
  }
}

export function claimEvent(provider: string, eventKey: string): Promise<ClaimResult> {
  return claimEventWith(sql(), provider, eventKey);
}

/**
 * Whether the UPDATE matched matters: a claim whose run id was never recorded
 * looks exactly like an orphaned claim, and the two need opposite recovery
 * ("the run is alive, its id was lost" vs "nothing ever started").
 */
export async function attachRunWith(
  query: QueryFn,
  provider: string,
  eventKey: string,
  runId: string,
): Promise<void> {
  const rows = await query`
    UPDATE event_ledger SET run_id = ${runId}
    WHERE provider = ${provider} AND event_key = ${eventKey}
    RETURNING run_id
  `;
  if (rows.length === 0) {
    throw new Error(`no ledger row to attach run ${runId} to (${provider}/${eventKey})`);
  }
}

export function attachRun(provider: string, eventKey: string, runId: string): Promise<void> {
  return attachRunWith(sql(), provider, eventKey, runId);
}

/**
 * Undoes a claim whose run never started. Without this the ledger row survives
 * with run_id IS NULL, the provider's retry hits the unique constraint, reads
 * back "already claimed", and the event is dropped for good.
 *
 * `run_id IS NULL` is the safety catch: a claim that did start a run is never
 * released, so a retry can never duplicate live work.
 */
export async function releaseClaimWith(
  query: QueryFn,
  provider: string,
  eventKey: string,
): Promise<void> {
  await query`
    DELETE FROM event_ledger
    WHERE provider = ${provider} AND event_key = ${eventKey} AND run_id IS NULL
  `;
}

export function releaseClaim(provider: string, eventKey: string): Promise<void> {
  return releaseClaimWith(sql(), provider, eventKey);
}
