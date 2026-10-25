import { NEON } from "../config.js";

export function notificacionesConfiguradas() {
  return Boolean(NEON.functionNotificacionesUrl && NEON.functionSecret);
}

/** Healthcheck de la Neon Function (sin secreto). */
export async function estadoFunction() {
  if (!NEON.functionNotificacionesUrl) return { ok: false, motivo: "URL de Function no configurada" };
  try {
    const response = await fetch(`${NEON.functionNotificacionesUrl}health`, {
      signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, url: NEON.functionNotificacionesUrl, ...data };
  } catch (error) {
    return { ok: false, url: NEON.functionNotificacionesUrl, motivo: error.message };
  }
}

/** Dispara el envío del certificado en la Neon Function. */
export async function notificarCertificado(payload) {
  if (!notificacionesConfiguradas()) {
    return { ok: false, entregado: false, motivo: "Function no configurada" };
  }

  try {
    const response = await fetch(`${NEON.functionNotificacionesUrl}notificar`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-foro-secret": NEON.functionSecret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, entregado: false, status: response.status, motivo: data.error ?? "Error de Function" };
    }
    return data;
  } catch (error) {
    return { ok: false, entregado: false, motivo: error.message };
  }
}
