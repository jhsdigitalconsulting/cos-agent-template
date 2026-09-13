import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";

const rl = createInterface({ input: process.stdin, output: process.stdout });

async function ask(question: string, fallback = ""): Promise<string> {
  const suffix = fallback ? ` (${fallback})` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback;
}

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

console.log("Configuring cos-agent-template for a new client.\n");
console.log("First, what should things be named?\n");

const clientName = await ask("Client display name (e.g. Acme Corp)");
const clientSlug = await ask(
  "Client slug, used in package/project names and the Slack connector (e.g. acme)",
  slugify(clientName),
);
const agentName = await ask("Agent display name (shown in the chat UI and instructions.md)", `${clientName} Agent`);
const agentVercelProject = await ask("Vercel project name for this agent app", `${clientSlug}-agent`);
const skynestVercelProject = await ask("Vercel project name for this client's Skynest vault", `${clientSlug}-skynest`);

console.log("\nNow the integration details.\n");

const slackConnectSlug = await ask("Vercel Connect Slack connector slug", `slack/${clientSlug}`);
const slackOpsChannel = await ask("Slack ops channel id (e.g. C0123456789)");
const notificationChannels = await ask("Notification channels (comma list: slack,teams)", "slack");
const teamsWebhookUrl = notificationChannels.includes("teams")
  ? await ask("Teams incoming webhook URL")
  : "";

rl.close();

// Shared config other scripts (init-skynest, vercel-setup) read for their own defaults.
const clientConfig = {
  clientName,
  clientSlug,
  agentName,
  agentVercelProject,
  skynestVercelProject,
};
await writeFile(new URL("../.cos-client.json", import.meta.url), `${JSON.stringify(clientConfig, null, 2)}\n`);
console.log("\nwrote .cos-client.json (naming shared with init-skynest.ts and vercel-setup.ts)");

// package.json name
const packageJsonPath = new URL("../package.json", import.meta.url);
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as Record<string, unknown>;
packageJson.name = `${clientSlug}-agent`;
await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log(`updated package.json name -> ${packageJson.name}`);

// app/layout.tsx placeholder substitution
const layoutPath = new URL("../app/layout.tsx", import.meta.url);
const layout = await readFile(layoutPath, "utf8");
await writeFile(layoutPath, layout.replaceAll("{{AGENT_NAME}}", agentName));
console.log("updated app/layout.tsx");

// agent/instructions.md placeholder substitution
const instructionsPath = new URL("../agent/instructions.md", import.meta.url);
const instructions = await readFile(instructionsPath, "utf8");
await writeFile(
  instructionsPath,
  instructions.replaceAll("{{AGENT_NAME}}", agentName).replaceAll("{{CLIENT_NAME}}", clientName),
);
console.log("updated agent/instructions.md");

// lib/slack-credentials.ts placeholder substitution
const slackCredentialsPath = new URL("../lib/slack-credentials.ts", import.meta.url);
const slackCredentials = await readFile(slackCredentialsPath, "utf8");
await writeFile(slackCredentialsPath, slackCredentials.replaceAll("slack/{{CLIENT_SLUG}}", slackConnectSlug));
console.log("updated lib/slack-credentials.ts");

// .env.local
const envLines = [
  `SLACK_CONNECT_SLUG=${slackConnectSlug}`,
  `SLACK_OPS_CHANNEL=${slackOpsChannel}`,
  `NOTIFICATION_CHANNELS=${notificationChannels}`,
  teamsWebhookUrl ? `TEAMS_WEBHOOK_URL=${teamsWebhookUrl}` : "TEAMS_WEBHOOK_URL=",
  "CTXNEST_URL=",
];
await writeFile(new URL("../.env.local", import.meta.url), `${envLines.join("\n")}\n`, { flag: "a" });
console.log("appended values to .env.local");

console.log(
  `\nDone. Still needed: DATABASE_URL(_UNPOOLED)/NEON_PROJECT_ID, BOT_GITHUB_TOKEN, GITHUB_REPO, EXAMPLE_WEBHOOK_SECRET.\n` +
    `Next: run "pnpm init:skynest" to bootstrap this client's Skynest vault, then "pnpm setup:vercel" to provision Vercel/Neon.`,
);
