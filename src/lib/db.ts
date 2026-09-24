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

// `postgres` automatically handles connection pooling.
// `max: 10` is safe for serverless environments like Vercel.
const client = postgres(connectionString, { max: 10 });

export const db = drizzle(client, { schema });
