import { neon } from "@neondatabase/serverless";
import { NEON } from "./config.js";

function esUrlValida(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "postgresql:";
  } catch {
    return false;
  }
}

// Driver HTTP serverless de Neon: cada query es una petición HTTP.
// Evita agotar conexiones en funciones serverless de Vercel.
// Fallback robusto: DATABASE_URL_UNPOOLED si DATABASE_URL no es una URL válida.
const connectionString =
  esUrlValida(NEON.databaseUrl) || esUrlValida(NEON.databaseUrlUnpooled)
    ? esUrlValida(NEON.databaseUrl)
      ? NEON.databaseUrl
      : NEON.databaseUrlUnpooled
    : "";
const sql = neon(connectionString);

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
