import { EVENTO } from "./config.js";
import { generarMensaje } from "./services/ai.js";
import { notificarCertificado } from "./services/notificaciones.js";
import { createCertificateToken } from "./auth.js";
import { query } from "./db.js";

const MENSAJE_FALLBACK =
  "Felicitaciones por tu participación y compromiso con las tecnologías emergentes.";

/**
 * Trabajo posterior a confirmar asistencia (en background, según INT-2):
 *  1. fila de outbox en certificado_envios
 *  2. mensaje del certificado (AI Gateway, con respaldo)
 *  3. envío por la Neon Function (Resend si hay key)
 */
export async function procesarPostAsistencia(estudiante, origin) {
  const resultado = { ai: null, envio: null };

  await query(
    `INSERT INTO certificado_envios (estudiante_id, estado)
     VALUES ($1, 'pendiente')
     ON CONFLICT (estudiante_id) DO NOTHING`,
    [estudiante.id],
  );

  const ai = await generarMensaje({ nombre: estudiante.nombre, apellido: estudiante.apellido });
  resultado.ai = ai.ok ? { ...ai, origen: "ai" } : { ...ai, origen: "fallback" };

  const mensaje = ai.ok ? ai.mensaje : MENSAJE_FALLBACK;
  await query(
    `INSERT INTO certificado_mensajes (estudiante_id, mensaje, modelo, origen)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (estudiante_id) DO UPDATE
        SET mensaje = EXCLUDED.mensaje,
            modelo = EXCLUDED.modelo,
            origen = EXCLUDED.origen,
            created_at = now()`,
    [estudiante.id, mensaje, ai.ok ? ai.modelo ?? null : null, ai.ok ? "ai" : "fallback"],
  );

  const token = createCertificateToken(estudiante.id);
  const enlace = `${origin}/c/${token}`;

  const envio = await notificarCertificado({
    correo: estudiante.correo,
    nombre: `${estudiante.nombre} ${estudiante.apellido}`,
    cedula: estudiante.cedula,
    evento: EVENTO.titulo,
    fecha: EVENTO.fechaTexto,
    enlace,
  });
  resultado.envio = envio;

  const estado = envio.entregado ? "enviado" : envio.ok ? "pendiente" : "error";
  await query(
    `UPDATE certificado_envios
        SET estado = $2,
            intentos = intentos + 1,
            ultimo_error = $3,
            enviado_en = CASE WHEN $4 THEN now() ELSE enviado_en END,
            actualizado_en = now()
      WHERE estudiante_id = $1`,
    [estudiante.id, estado, envio.motivo ?? null, Boolean(envio.entregado)],
  );

  return resultado;
}
