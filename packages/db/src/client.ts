import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { loadEnv } from "./env";
import * as schema from "./schema";

loadEnv();
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL mangler");

const client = postgres(url, { prepare: false });
export const db = drizzle(client, { schema });
export { schema };
