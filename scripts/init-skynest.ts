import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { applyCtxnestUrl } from "./lib/ctxnest.ts";

const rl = createInterface({ input: process.stdin, output: process.stdout });

async function ask(question: string, fallback = ""): Promise<string> {
  const suffix = fallback ? ` (${fallback})` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback;
}

function run(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

interface ClientConfig {
  clientSlug: string;
  skynestVercelProject: string;
}

async function readClientConfig(): Promise<Partial<ClientConfig>> {
  try {
    return JSON.parse(await readFile(new URL("../.cos-client.json", import.meta.url), "utf8")) as ClientConfig;
  } catch {
    return {};
  }
}

console.log("Bootstrapping a sibling Skynest (Context Nest) vault for this client.\n");

const clientConfig = await readClientConfig();
const clientSlug = await ask("Client slug (matches what you gave init-client)", clientConfig.clientSlug ?? "");
const skynestVercelProject = clientConfig.skynestVercelProject ?? `${clientSlug}-skynest`;
const projectDir = new URL(`../../${clientSlug}-skynest/`, import.meta.url);
const projectPath = projectDir.pathname;

console.log(`\nCloning jhsdigitalconsulting/skynest into ${projectPath} ...`);
await run("git", ["clone", "https://github.com/jhsdigitalconsulting/skynest.git", projectPath], ".");

console.log("\nInstalling dependencies...");
await run("pnpm", ["install"], projectPath);

console.log("\nGenerating OAuth JWT signing keypair...");
await run("pnpm", ["oauth:gen-keypair"], projectPath);

const generatedEnvPath = new URL("./.env.local", projectDir);
let privateKey = "";
let publicKey = "";
try {
  const generatedEnv = await readFile(generatedEnvPath, "utf8");
  privateKey = /OAUTH_JWT_PRIVATE_KEY=(.*)/.exec(generatedEnv)?.[1] ?? "";
  publicKey = /OAUTH_JWT_PUBLIC_KEY=(.*)/.exec(generatedEnv)?.[1] ?? "";
} catch {
  // oauth:gen-keypair may print the keys instead of writing .env.local directly;
  // in that case paste them in when prompted below.
}

console.log(
  "\n--- Manual step required: GitHub OAuth App ---\n" +
    "GitHub has no public API to create OAuth Apps, so this step can't be automated.\n" +
    "1. Go to https://github.com/settings/developers -> \"New OAuth App\".\n" +
    `2. Application name: ${skynestVercelProject}\n` +
    "3. Homepage URL: the Vercel production URL you'll deploy this project to (set it after step vercel-setup, or use a placeholder now and update it later).\n" +
    "4. Authorization callback URL: <homepage-url>/api/auth/callback/github\n" +
    "5. Create the app, then copy its Client ID and generate a Client Secret.\n",
);

const githubClientId = await ask("GitHub OAuth App Client ID");
const githubClientSecret = await ask("GitHub OAuth App Client Secret");
const nextAuthUrl = await ask("This Skynest deployment's URL (e.g. https://ctx.client.com)");
if (!privateKey) privateKey = await ask("OAUTH_JWT_PRIVATE_KEY (paste from oauth:gen-keypair output)");
if (!publicKey) publicKey = await ask("OAUTH_JWT_PUBLIC_KEY (paste from oauth:gen-keypair output)");
const authSecret = await ask("AUTH_SECRET (leave blank to generate one)") || crypto.randomUUID();

rl.close();

const skynestEnv = [
  `GITHUB_CLIENT_ID=${githubClientId}`,
  `GITHUB_CLIENT_SECRET=${githubClientSecret}`,
  `AUTH_SECRET=${authSecret}`,
  `NEXTAUTH_URL=${nextAuthUrl}`,
  `OAUTH_JWT_PRIVATE_KEY=${privateKey}`,
  `OAUTH_JWT_PUBLIC_KEY=${publicKey}`,
  "CONTEXTNEST_STORAGE=blob",
  `CONTEXTNEST_BLOB_PREFIX=${clientSlug}`,
  "BLOB_READ_WRITE_TOKEN=",
].join("\n");
await writeFile(new URL("./.env.local", projectDir), `${skynestEnv}\n`);
console.log(`\nWrote ${projectPath}.env.local (BLOB_READ_WRITE_TOKEN still blank — set it after connecting a Vercel Blob store).`);

const ctxnestUrl = `${nextAuthUrl.replace(/\/$/, "")}/api/mcp`;
await applyCtxnestUrl(ctxnestUrl);

console.log(
  `\nDone. Next: run "pnpm setup:vercel" for both this project and ${projectPath} to deploy and connect a Vercel Blob store.`,
);
