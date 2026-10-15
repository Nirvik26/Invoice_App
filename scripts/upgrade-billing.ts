import { config } from "dotenv";
import postgres from "postgres";
import { readFile } from "node:fs/promises";

config({ path: ".env.local", quiet: true });
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const migration = await readFile(
      "migrations/001_proposals_payments.sql",
      "utf8",
    );
    await sql.begin(async (tx) => {
      await tx.unsafe(migration);
    });
    console.log("Proposal and payment schema upgraded successfully.");
  } finally {
    await sql.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
