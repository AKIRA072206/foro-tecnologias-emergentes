import { Router } from "express";
import { requireStaff } from "../auth.js";
import { query } from "../db.js";
import { NEON, STORAGE } from "../config.js";
import { estadoStorage } from "../services/storage.js";
import { estadoFunction, notificacionesConfiguradas } from "../services/notificaciones.js";
import { listarModelos } from "../services/ai.js";
import { realtimeConfigurado } from "../services/realtime.js";

export const serviciosRouter = Router();

async function estadoDb() {
  try {
    const { rows } = await query(
      `SELECT current_database() AS db,
              now() AS ahora,
              (SELECT count(*)::int FROM estudiantes) AS estudiantes,
              (SELECT count(*)::int FROM certificado_envios) AS envios`,
    );
    return { ok: true, ...rows[0] };
  } catch (error) {
    return { ok: false, motivo: error.message };
  }
}

async function estadoAuth() {
  if (!NEON.authBaseUrl) return { ok: false, motivo: "NEON_AUTH_BASE_URL no configurada" };
  try {
    const response = await fetch(`${NEON.authBaseUrl}/ok`, {
      signal: AbortSignal.timeout(10_000),
    });
    return { ok: response.ok, status: response.status, baseUrl: NEON.authBaseUrl };
  } catch (error) {
    return { ok: false, motivo: error.message };
  }
}

serviciosRouter.get("/api/servicios/estado", requireStaff, async (_req, res) => {
  const [db, auth, storage, functions, ai] = await Promise.all([
    estadoDb(),
    estadoAuth(),
    estadoStorage(),
    estadoFunction(),
    listarModelos(),
  ]);

  return res.json({
    ok: true,
    branch: NEON.branch,
    database: db,
    auth,
    storage,
    functions,
    aiGateway: ai,
    realtime: {
      ok: realtimeConfigurado,
      url: NEON.realtimeUrl || null,
      secretConfigured: Boolean(NEON.realtimeSecret),
    },
    bucket: STORAGE.bucket,
    functionsConfigured: notificacionesConfiguradas(),
    aiBaseUrl: NEON.aiBaseUrl || null,
  });
});

serviciosRouter.get("/api/ai/estado", requireStaff, async (_req, res) => {
  const resultado = await listarModelos();
  return res.status(resultado.ok ? 200 : 503).json(resultado);
});

serviciosRouter.get("/api/realtime/config", requireStaff, (_req, res) =>
  res.json({ ok: realtimeConfigurado, url: NEON.realtimeUrl || null }),
);
