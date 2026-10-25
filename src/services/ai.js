import { NEON } from "../config.js";

function configurado() {
  return Boolean(NEON.aiBaseUrl && NEON.aiToken);
}

/**
 * Catálogo en vivo del gateway de la rama (`/v1/models`).
 * En plan Free el gateway responde con error de plan; se propaga tal cual.
 */
export async function listarModelos() {
  if (!configurado()) {
    return { ok: false, motivo: "NEON_AI_GATEWAY_BASE_URL / TOKEN no configurados (plan Free)" };
  }

  try {
    const response = await fetch(`${NEON.aiBaseUrl}/v1/models`, {
      headers: { authorization: `Bearer ${NEON.aiToken}` },
    });
    const texto = await response.text();
    if (!response.ok) {
      return { ok: false, status: response.status, motivo: texto.slice(0, 300) };
    }
    const data = JSON.parse(texto);
    const modelos = (data.data ?? []).filter((m) => m.enabled !== false).map((m) => m.id);
    return { ok: true, total: modelos.length, modelos: modelos.slice(0, 10) };
  } catch (error) {
    return { ok: false, motivo: `Gateway inaccesible: ${error.message}` };
  }
}

/** Chat completion (dialecto OpenAI) para el mensaje del certificado. */
export async function generarMensaje({ nombre, apellido }) {
  if (!configurado()) {
    return { ok: false, motivo: "AI Gateway no configurado" };
  }

  try {
    const response = await fetch(`${NEON.aiBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${NEON.aiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: NEON.aiModel,
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content:
              "Redactas una frase breve (máximo 30 palabras) de felicitación para un certificado de asistencia. Responde solo la frase, en español, sin comillas.",
          },
          {
            role: "user",
            content: `Participante: ${nombre} ${apellido}. Evento: II Foro de Tecnologías Emergentes: Inteligencia Artificial, UPTYAB.`,
          },
        ],
      }),
    });

    const texto = await response.text();
    if (!response.ok) {
      return { ok: false, status: response.status, motivo: texto.slice(0, 300) };
    }

    const data = JSON.parse(texto);
    const mensaje = data?.choices?.[0]?.message?.content?.trim();
    if (!mensaje) return { ok: false, motivo: "Respuesta sin contenido" };
    return { ok: true, mensaje, modelo: data.model ?? NEON.aiModel };
  } catch (error) {
    return { ok: false, motivo: `Gateway inaccesible: ${error.message}` };
  }
}
