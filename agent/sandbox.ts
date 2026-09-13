import { defineSandbox } from "eve/sandbox";
import type { SandboxNetworkPolicy } from "eve/sandbox";
import { vercel } from "eve/sandbox/vercel";

/**
 * Gives the agent a real sandbox so it can clone this repo, investigate a
 * failed webhook delivery (see list_webhook_failures / get_webhook_failure),
 * make a fix, and open a PR for review — rather than only reporting the
 * failure. BOT_GITHUB_TOKEN (already used for the Skynest MCP connection in
 * agent/connections/ctxnest.ts) is reused here as the sandbox's git/gh
 * credential, so it needs `repo` scope on GITHUB_REPO for repairs to work.
 *
 * Network is locked to GitHub and the npm registry (needed for `pnpm install`
 * while verifying a fix) rather than left allow-all. GitHub auth is injected
 * at the firewall via a header transform so the token never has to appear in
 * a sandbox command string; GH_TOKEN is also set as a sandbox env var because
 * the `gh` CLI reads its own credential rather than relying on git's HTTP
 * auth — and because the repair tool's `curl` calls to the REST API use it.
 */
const token = process.env.BOT_GITHUB_TOKEN;

function networkPolicy(): SandboxNetworkPolicy {
  if (!token) return "deny-all";

  const basicAuth = Buffer.from(`x-access-token:${token}`).toString("base64");
  return {
    allow: {
      "github.com": [{ transform: [{ headers: { authorization: `Basic ${basicAuth}` } }] }],
      "api.github.com": [{ transform: [{ headers: { authorization: `Bearer ${token}` } }] }],
      "registry.npmjs.org": [],
    },
  };
}

export default defineSandbox({
  // The factory is the security baseline: a provider-loss sandbox
  // replacement reuses it without rerunning onSession, so the restrictive
  // policy has to live here too, not only in onSession's use() below.
  // `env` is likewise a creation-time-only option (not available on
  // onSession's `use()`), so GH_TOKEN is set here for the `gh` CLI, which
  // reads its own credential rather than relying on git's HTTP auth.
  backend: vercel({ networkPolicy: networkPolicy(), ...(token ? { env: { GH_TOKEN: token } } : {}) }),
  async onSession({ use }) {
    await use({ networkPolicy: networkPolicy() });
  },
});
