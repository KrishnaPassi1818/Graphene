import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

let pool = null;

export async function initializeDatabase() {
  if (!process.env.DATABASE_URL) return { enabled: false, status: "disabled" };
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    connectionTimeoutMillis: 5000,
    ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
  });
  const schema = await readFile(fileURLToPath(new URL("./schema.sql", import.meta.url)), "utf8");
  await pool.query(schema);
  await pool.query("SELECT 1");
  return { enabled: true, status: "ready" };
}

export function getPool() { return pool; }

export async function databaseHealth() {
  if (!pool) return { status: "disabled" };
  try { await pool.query("SELECT 1"); return { status: "ready" }; }
  catch { return { status: "error" }; }
}

export async function closeDatabase() {
  if (pool) { await pool.end(); pool = null; }
}
