import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "dotenv";

/**
 * Laster `.env.local` (så `.env`) fra nærmeste forelder-mappe oppover fra cwd.
 * Lar én rot-`.env.local` forsyne både drizzle-kit (kjører i packages/db) og
 * Next-appen (kjører i apps/web) uten duplisering. På hostet miljø er
 * DATABASE_URL allerede i process.env, og dette blir en no-op.
 */
export function loadEnv(): void {
  if (process.env.DATABASE_URL) return;
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    for (const name of [".env.local", ".env"]) {
      const file = join(dir, name);
      if (existsSync(file)) config({ path: file });
    }
    if (process.env.DATABASE_URL) return;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}
