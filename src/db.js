import { neon } from "@neondatabase/serverless";
import { NEON } from "./config.js";

// Driver HTTP serverless de Neon: cada query es una petición HTTP.
// Evita agotar conexiones en funciones serverless de Vercel.
const sql = neon(NEON.databaseUrl);

export async function query(text, params = []) {
  const rows = await sql.query(text, params);
  return { rows, rowCount: Array.isArray(rows) ? rows.length : 0 };
}

export async function queryOne(text, params = []) {
  const rows = await sql.query(text, params);
  return rows[0] ?? null;
}

export function dbName() {
  try {
    return new URL(NEON.databaseUrl).pathname.replace(/^\//, "") || "neondb";
  } catch {
    return "neondb";
  }
}

export { sql };
