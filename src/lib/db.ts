import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// ── Connection ─────────────────────────────────────────────────────────────
// In Next.js, module-level singletons are safe in the Node.js runtime.
// We rely on DATABASE_URL set in .env.local (or the deployment platform).

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local:\n" +
      "  DATABASE_URL=postgresql://user:password@host:5432/billora"
  );
}

// Budget connections across replicas; use Neon's pooler for the runtime URL.
const poolMax = Number(process.env.DB_POOL_MAX || 5);
if (!Number.isInteger(poolMax) || poolMax < 1 || poolMax > 50) throw new Error("DB_POOL_MAX must be 1–50.");
const globalDb = globalThis as unknown as { billoraSql?: ReturnType<typeof postgres> };
const client = globalDb.billoraSql ?? postgres(connectionString, { max: poolMax, idle_timeout: 20, connect_timeout: 10, max_lifetime: 1800, prepare: false });
if (process.env.NODE_ENV !== "production") globalDb.billoraSql = client;
export const db = drizzle(client, { schema });
