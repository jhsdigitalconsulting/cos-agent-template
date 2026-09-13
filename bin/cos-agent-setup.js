#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const setupScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "setup.ts");
const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", setupScript, ...process.argv.slice(2)],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
