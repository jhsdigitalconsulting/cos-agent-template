import type { NeonQueryFunction } from "@neondatabase/serverless";
import { neon } from "@neondatabase/serverless";
import { requireEnv } from "../config";

let cached: NeonQueryFunction<false, false> | null = null;

export function sql(): NeonQueryFunction<false, false> {
  if (cached === null) {
    cached = neon(requireEnv("DATABASE_URL"));
  }
  return cached;
}
