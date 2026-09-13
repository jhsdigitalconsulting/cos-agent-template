import { defineMcpClientConnection } from "eve/connections";
import { requireEnv } from "../../lib/config";

/**
 * MCP client connection to this client's Skynest (Context Nest) vault — the
 * same kind of connection sma-automation has to ctx.silvamethodatlanta.com.
 * `scripts/init-skynest.ts` sets CTXNEST_URL once the sibling Skynest project
 * is deployed. Falls back to a placeholder so a fresh template still compiles
 * and runs before that step; calls to this connection will simply fail until
 * CTXNEST_URL is set.
 */
export default defineMcpClientConnection({
  url: process.env.CTXNEST_URL ?? "https://ctx.example.com/api/mcp",
  description:
    "This client's Skynest vault: store and retrieve agent skills, learnings, and notes.",
  auth: {
    getToken: async () => ({ token: requireEnv("BOT_GITHUB_TOKEN") }),
  },
});
