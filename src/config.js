import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// `.env.local` primero (lo escribe `neon env pull`), `.env` como respaldo.
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const bool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on", "si", "sí"].includes(String(value).toLowerCase());
};

export const ROOT = root;
export const IS_PROD = process.env.NODE_ENV === "production";
export const PORT = Number(process.env.PORT ?? 3000);

export const EVENTO = {
  fecha: process.env.FORO_EVENTO_FECHA ?? "2026-11-06",
  fechaTexto: "06 de noviembre de 2026",
  horaTexto: "8:00 AM",
  titulo: "II Foro de Tecnologías Emergentes: Inteligencia Artificial",
};

// null = automático por fecha | true/false = forzar
export const FORZAR_ASISTENCIA = process.env.FORO_FORZAR_ASISTENCIA
  ? bool(process.env.FORO_FORZAR_ASISTENCIA)
  : true;

export const STAFF = {
  usuario: process.env.FORO_USER ?? "logistica",
  password: process.env.FORO_PASS ?? "foro2026",
  passwordHash: process.env.FORO_PASS_HASH ?? null,
  email: process.env.FORO_STAFF_EMAIL ?? `${process.env.FORO_USER ?? "logistica"}@foro.local`,
  jwtSecret: process.env.FORO_JWT_SECRET ?? "foro-dev-secret-change-me",
  certSecret:
    process.env.FORO_CERT_SECRET ??
    process.env.FORO_JWT_SECRET ??
    "foro-dev-secret-change-me",
  sessionCookie: "foro_session",
  csrfCookie: "foro_csrf",
  ttlSeconds: 8 * 60 * 60,
};

export const NEON = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  databaseUrlUnpooled: process.env.DATABASE_URL_UNPOOLED ?? "",
  branch: process.env.NEON_BRANCH ?? "",
  authBaseUrl: process.env.NEON_AUTH_BASE_URL ?? "",
  authJwksUrl: process.env.NEON_AUTH_JWKS_URL ?? "",
  realtimeUrl: process.env.NEON_REALTIME_URL ?? "",
  realtimeSecret: process.env.NEON_REALTIME_SECRET ?? "",
  functionNotificacionesUrl: (process.env.NEON_FUNCTION_NOTIFICACIONES_BASE_URL ?? "").replace(/\/?$/, "/"),
  functionSecret: process.env.FORO_FUNCTION_SECRET ?? "",
  aiBaseUrl: process.env.NEON_AI_GATEWAY_BASE_URL ?? "",
  aiToken: process.env.NEON_AI_GATEWAY_TOKEN ?? "",
  aiModel: process.env.FORO_AI_MODEL ?? "gpt-5-mini",
};

export const STORAGE = {
  bucket: process.env.FORO_BUCKET ?? "certificados",
  endpoint: process.env.AWS_ENDPOINT_URL_S3 ?? "",
  region: process.env.AWS_REGION ?? "",
};

export function asistenciaHabilitada() {
  if (FORZAR_ASISTENCIA !== null) return FORZAR_ASISTENCIA;
  const hoy = new Date().toISOString().slice(0, 10);
  return hoy >= EVENTO.fecha;
}
