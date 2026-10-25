/**
 * Neon Function: notificaciones
 *
 * Responsabilidades:
 *  - GET  /health          → healthcheck sin autenticación
 *  - POST /notificar       → envía el certificado por correo con Resend
 *
 * El certificado se envía SOLO si existe RESEND_API_KEY en el entorno de la
 * Function. Sin key responde `entregado: false` y el llamador (Express) lo
 * registra como pendiente en `certificado_envios`.
 *
 * La Function tiene URL pública: toda petición de trabajo exige el header
 * `x-foro-secret` (FORO_FUNCTION_SECRET), compartido con el servidor Express.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function renderHtml({ nombre, evento, fecha, enlace }) {
  const seguro = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[char];
    });

  return `<!doctype html>
<html lang="es"><body style="font-family:Arial,Helvetica,sans-serif;background:#f5f7fb;padding:24px">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px">
    <tr><td style="padding:32px">
      <h1 style="margin:0 0 12px;font-size:20px;color:#001b48">${seguro(evento)}</h1>
      <p style="margin:0 0 16px;color:#333">Hola <strong>${seguro(nombre)}</strong>,</p>
      <p style="margin:0 0 16px;color:#333">Gracias por acompañarnos el ${seguro(fecha)}. Tu certificado de asistencia ya está disponible.</p>
      <p style="margin:0 0 24px">
        <a href="${seguro(enlace)}" style="background:#0d6efd;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">
          Descargar certificado
        </a>
      </p>
      <p style="margin:0;color:#777;font-size:12px">Si el botón no funciona, copia este enlace: ${seguro(enlace)}</p>
    </td></tr>
  </table>
</body></html>`;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname.endsWith("/health")) {
      return json({ ok: true, service: "notificaciones", resend: Boolean(process.env.RESEND_API_KEY) });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "Método no permitido" }, 405);
    }

    const expected = process.env.FORO_FUNCTION_SECRET;
    const received = request.headers.get("x-foro-secret");
    if (!expected || received !== expected) {
      return json({ ok: false, error: "No autorizado" }, 401);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: "JSON inválido" }, 400);
    }

    const { correo, nombre, evento, fecha, enlace, cedula } = payload ?? {};
    if (!correo || !nombre || !enlace) {
      return json({ ok: false, error: "Faltan correo, nombre o enlace" }, 422);
    }

    if (!process.env.RESEND_API_KEY) {
      return json({
        ok: true,
        entregado: false,
        motivo: "RESEND_API_KEY no configurada en la Function",
      });
    }

    const respuesta = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "II Foro <certificados@resend.dev>",
        to: [correo],
        subject: `Tu certificado — ${evento}`,
        html: renderHtml({ nombre, evento, fecha, enlace }),
      }),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => "");
      return json({ ok: false, entregado: false, motivo: `Resend ${respuesta.status}`, detalle }, 502);
    }

    const data = await respuesta.json().catch(() => ({}));
    return json({ ok: true, entregado: true, id: data.id ?? null, cedula: cedula ?? null });
  },
};
