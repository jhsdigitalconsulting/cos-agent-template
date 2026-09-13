import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";

const rl = createInterface({ input: process.stdin, output: process.stdout });

async function ask(question: string, fallback = ""): Promise<string> {
  const suffix = fallback ? ` (${fallback})` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback;
}

async function confirm(question: string): Promise<boolean> {
  const answer = (await rl.question(`${question} [y/N]: `)).trim().toLowerCase();
  return answer === "y" || answer === "yes";
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

async function parseEnvLocal(path: string): Promise<Record<string, string>> {
  try {
    const contents = await readFile(path, "utf8");
    const env: Record<string, string> = {};
    for (const line of contents.split("\n")) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match) env[match[1]] = match[2];
    }
    return env;
  } catch {
    return {};
  }
}

console.log("Provisioning a Vercel project from a .env.local file.\n");

const targetDir = await ask("Target directory to provision", ".");
const projectName = await ask("Vercel project name");

console.log(`\nLinking Vercel project in ${targetDir} ...`);
await run("vercel", ["link", "--yes", "--project", projectName], targetDir);

const envPath = `${targetDir.replace(/\/$/, "")}/.env.local`;
const env = await parseEnvLocal(envPath);
const envKeys = Object.keys(env).filter((key) => env[key] !== "");

if (envKeys.length === 0) {
  console.log(`\nNo non-empty variables found in ${envPath} — nothing to push. Run init-client/init-skynest first.`);
} else {
  console.log(`\nPushing ${envKeys.length} environment variable(s) from ${envPath} to Vercel (production + preview)...`);
  for (const key of envKeys) {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("vercel", ["env", "add", key, "production", "preview"], { cwd: targetDir, stdio: ["pipe", "inherit", "inherit"] });
      child.stdin.write(`${env[key]}\n`);
      child.stdin.end();
      child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`vercel env add ${key} exited with code ${code}`))));
      child.on("error", reject);
    });
  }
}

if (await confirm("\nProvision a Neon Postgres database for this project now (via the Neon MCP tools available in this Claude Code session)?")) {
  console.log(
    "\nAsk your Claude Code session to: create a Neon project for this client, run lib/db/schema.sql against it, " +
      "and push the resulting DATABASE_URL / DATABASE_URL_UNPOOLED / NEON_PROJECT_ID with:\n" +
      `  vercel env add DATABASE_URL production preview   (cwd: ${targetDir})\n` +
      "This script does not call the Neon MCP tools itself — only your Claude Code session has access to them.",
  );
} else {
  console.log(
    "\nManual Neon setup: create a project at https://console.neon.tech, run lib/db/schema.sql against it (pnpm migrate), " +
      "then vercel env add DATABASE_URL / DATABASE_URL_UNPOOLED / NEON_PROJECT_ID.",
  );
}

if (await confirm("\nIs this a Skynest deployment (needs a Vercel Blob store for CONTEXTNEST_STORAGE=blob)?")) {
  console.log(
    "\nConnect a Blob store from the Vercel dashboard: Project -> Storage -> Create Database -> Blob, then\n" +
      `  vercel env add BLOB_READ_WRITE_TOKEN production preview   (cwd: ${targetDir})\n` +
      "pulling the token Vercel generates when you connect the store.",
  );
}

rl.close();
console.log("\nDone. Deploy with: vercel --prod  (or eve deploy, for the agent app).");
