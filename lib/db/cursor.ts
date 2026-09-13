import { sql } from "./client";

export type CursorQueryFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

export async function getCursorWith(query: CursorQueryFn, provider: string): Promise<string | null> {
  const rows = (await query`
    SELECT cursor_value FROM sync_cursors WHERE provider = ${provider}
  `) as Array<{ cursor_value: string }>;
  return rows[0]?.cursor_value ?? null;
}

export function getCursor(provider: string): Promise<string | null> {
  return getCursorWith(sql(), provider);
}

export async function setCursorWith(
  query: CursorQueryFn,
  provider: string,
  value: string,
): Promise<void> {
  await query`
    INSERT INTO sync_cursors (provider, cursor_value, updated_at)
    VALUES (${provider}, ${value}, now())
    ON CONFLICT (provider) DO UPDATE SET cursor_value = ${value}, updated_at = now()
  `;
}

export function setCursor(provider: string, value: string): Promise<void> {
  return setCursorWith(sql(), provider, value);
}
