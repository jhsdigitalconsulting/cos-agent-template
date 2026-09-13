import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { requireEnv } from "../lib/config.ts";

const schema = await readFile(new URL("../lib/db/schema.sql", import.meta.url), "utf8");
const sql = neon(requireEnv("DATABASE_URL"));

for (const statement of schema.split(";").map((s) => s.trim()).filter(Boolean)) {
  await sql.query(statement);
  console.log(`applied: ${statement.split("\n")[0]}`);
}

console.log("migration complete");
