#!/usr/bin/env -S node --experimental-strip-types
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { applyCtxnestUrl } from "./lib/ctxnest.ts";

const rl = createInterface({ input: process.stdin, output: process.stdout });

async function ask(question: string, fallback = ""): Promise<string> {
  const suffix = fallback ? ` (${fallback})` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback;
}

async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  const answer = (await rl.question(`${question} ${hint}: `)).trim().toLowerCase();
  if (!answer) return defaultYes;
  return answer === "y" || answer === "yes";
}

function run(command: string, args: string[], cwd = "."): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, ["--version"], { stdio: "ignore" });
    child.on("exit", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

function currentGitRemote(): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn("git", ["remote", "get-url", "origin"], { stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.on("exit", (code) => resolve(code === 0 ? output.trim() : null));
    child.on("error", () => resolve(null));
  });
}

interface ClientConfig {
  clientName: string;
  clientSlug: string;
  agentName: string;
  agentVercelProject: string;
  skynestVercelProject: string;
}

async function readClientConfig(): Promise<Partial<ClientConfig>> {
  try {
    return JSON.parse(await readFile(new URL("../.cos-client.json", import.meta.url), "utf8")) as ClientConfig;
  } catch {
    return {};
  }
}

console.log("cos-agent-template setup\n");
console.log("This walks through everything needed to turn this template into a working");
console.log("client agent: dependencies, naming, a dedicated GitHub repo, the Skynest");
console.log("vault, and Vercel provisioning. Each step can be skipped and re-run later");
console.log("on its own (pnpm init:client / init:skynest / setup:vercel).\n");

if (!existsSync(new URL("../node_modules", import.meta.url))) {
  console.log("Installing dependencies (pnpm install)...\n");
  await run("pnpm", ["install"]);
}

console.log("\n--- Step 1: naming & integrations (init-client) ---\n");
await run("node", ["--experimental-strip-types", "scripts/init-client.ts"]);

const clientConfig = await readClientConfig();

console.log("\n--- Step 2: GitHub repository ---\n");
if (await confirm("Create a new GitHub repository for this agent now?")) {
  const hasGh = await commandExists("gh");
  if (!hasGh) {
    console.log(
      "\nThe GitHub CLI (`gh`) isn't installed, so this step can't run automatically.\n" +
        "Install it from https://cli.github.com, then run:\n" +
        `  gh repo create <owner>/${clientConfig.agentVercelProject ?? "your-agent-repo"} --private --source=. --remote=origin --push`,
    );
  } else {
    const existingRemote = await currentGitRemote();
    if (existingRemote) {
      console.log(`\nThis repo already has an "origin" remote: ${existingRemote}`);
      if (
        await confirm(
          "Remove it and create a fresh GitHub repo for this client (recommended if that's still the template's own repo)?",
        )
      ) {
        await run("git", ["remote", "remove", "origin"]);
      } else {
        console.log("Leaving the existing remote in place; skipping GitHub repo creation.");
      }
    }

    if (!existingRemote || !(await currentGitRemote())) {
      const repoName = await ask("New GitHub repo name", clientConfig.agentVercelProject ?? "cos-agent");
      const visibility = (await confirm("Make it private?")) ? "--private" : "--public";
      await run("gh", ["repo", "create", repoName, visibility, "--source=.", "--remote=origin", "--push"]);
      console.log(`\nCreated and pushed to a new GitHub repo: ${repoName}`);
    }
  }
} else {
  console.log("Skipped GitHub repo creation.");
}

console.log("\n--- Step 3: Skynest (Context Nest) knowledge vault ---\n");
if (await confirm("Does this client already have a Skynest vault deployed?", false)) {
  const existingCtxnestUrl = await ask("Skynest MCP URL (e.g. https://ctx.client.com/api/mcp)");
  if (existingCtxnestUrl) {
    await applyCtxnestUrl(existingCtxnestUrl);
  } else {
    console.log("No URL given — skipped. Set CTXNEST_URL in .env.local whenever you have it.");
  }
} else if (await confirm("Create and bootstrap a new Skynest vault for this client now?", false)) {
  await run("node", ["--experimental-strip-types", "scripts/init-skynest.ts"]);
} else {
  console.log('Skipped. Run "pnpm init:skynest" whenever you\'re ready.');
}

console.log("\n--- Step 4: Vercel provisioning (optional) ---\n");
if (await confirm("Run Vercel project/env provisioning now?", false)) {
  await run("node", ["--experimental-strip-types", "scripts/vercel-setup.ts"]);
} else {
  console.log('Skipped. Run "pnpm setup:vercel" whenever you\'re ready.');
}

rl.close();
console.log("\nSetup complete.");
