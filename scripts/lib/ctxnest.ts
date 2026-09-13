import { readFile, writeFile } from "node:fs/promises";

/**
 * Points this repo at a Skynest (Context Nest) MCP deployment: updates the
 * runtime connection's fallback URL, Claude Code's own `.mcp.json`, and
 * `.env.local`. Safe to call more than once (e.g. re-run after redeploying
 * Skynest elsewhere) — every write replaces the prior value rather than
 * appending a duplicate.
 */
export async function applyCtxnestUrl(ctxnestUrl: string): Promise<void> {
  const ctxnestConnectionPath = new URL("../../agent/connections/ctxnest.ts", import.meta.url);
  const ctxnestConnection = await readFile(ctxnestConnectionPath, "utf8");
  await writeFile(
    ctxnestConnectionPath,
    ctxnestConnection.replace(
      /url: process\.env\.CTXNEST_URL \?\? "[^"]*"/,
      `url: process.env.CTXNEST_URL ?? "${ctxnestUrl}"`,
    ),
  );
  console.log("updated agent/connections/ctxnest.ts");

  const mcpJsonPath = new URL("../../.mcp.json", import.meta.url);
  const mcpJson = JSON.parse(await readFile(mcpJsonPath, "utf8")) as {
    mcpServers: Record<string, { type: string; url: string }>;
  };
  mcpJson.mcpServers.ctxnest.url = ctxnestUrl;
  await writeFile(mcpJsonPath, `${JSON.stringify(mcpJson, null, 2)}\n`);
  console.log("updated .mcp.json");

  await upsertEnvLocal("CTXNEST_URL", ctxnestUrl);
  console.log("updated CTXNEST_URL in this repo's .env.local");
}

async function upsertEnvLocal(key: string, value: string): Promise<void> {
  const envLocalPath = new URL("../../.env.local", import.meta.url);
  let contents = "";
  try {
    contents = await readFile(envLocalPath, "utf8");
  } catch {
    // no .env.local yet
  }

  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  contents = pattern.test(contents) ? contents.replace(pattern, line) : `${contents.replace(/\n?$/, "\n")}${line}\n`;
  await writeFile(envLocalPath, contents.replace(/^\n/, ""));
}
