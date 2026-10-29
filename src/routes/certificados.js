import { Router, raw } from "express";
import { EVENTO } from "../config.js";
import {
  createCertificateToken,
  requireStaff,
  readCertificateToken,
  isAjax,
  verifyCsrf,
} from "../auth.js";
import * as Estudiantes from "../models/estudiantes.js";
import { query } from "../db.js";
import { storageKey, subirCertificado, urlCertificado } from "../services/storage.js";
import { generarMensaje } from "../services/ai.js";

export const certificadosRouter = Router();

function renderConsulta(res, status, { mensaje = null, tipo = null } = {}) {
  return res.status(status).render("certificados/index", {
    title: "Consulta de Certificados",
    page: "certificados",
    mensaje,
    tipo,
    evento: EVENTO,
  });
}

function renderCertificado(res, status, estudiante, { publico = false } = {}) {
  const nombreCompleto = `${estudiante.nombre ?? ""} ${estudiante.apellido ?? ""}`
    .trim()
    .toLocaleUpperCase("es");
  const codigo = `CERT-${String(estudiante.id ?? 0).padStart(6, "0")}`;
  const archivoPdf = `Certificado_Asistencia_${nombreCompleto.replace(/[^A-Za-z0-9_-]+/g, "_")}.pdf`;

  return res.status(status).render("certificados/ver", {
    title: `Certificado de Asistencia — ${nombreCompleto}`,
    page: "certificado-print",
    estudiante: { ...estudiante, nombreCompleto, codigo },
    nombreCompleto,
    codigo,
    archivoPdf,
    eventoFecha: EVENTO.fechaTexto,
    eventoTitulo: EVENTO.titulo,
    publico,
    volverHref: publico ? "/registro" : "/certificados",
  });
}

certificadosRouter.get("/certificados", requireStaff, (_req, res) => renderConsulta(res, 200));

certificadosRouter.get("/certificados/buscar", requireStaff, async (req, res) => {
  const cedula = String(req.query?.cedula ?? "").replace(/\D+/g, "");

  if (!/^[0-9]{6,10}$/.test(cedula)) {
    return renderConsulta(res, 400, {
      mensaje: "Ingrese una cédula válida (solo números, máximo 10 dígitos).",
      tipo: "error",
    });
  }

  try {
    const estudiante = await Estudiantes.buscarPorCedula(cedula);
    if (!estudiante) {
      return renderConsulta(res, 404, {
        mensaje: "No se encontró un registro con esa cédula.",
        tipo: "error",
      });
    }

    if (!estudiante.asistio) {
      return renderConsulta(res, 403, {
        mensaje:
          "El participante aún no tiene asistencia confirmada. El certificado no está disponible.",
        tipo: "error",
      });
    }

    return res.redirect(`/certificados/${Number(estudiante.id)}`);
  } catch (error) {
    console.error("[certificados/buscar]", error.message);
    return renderConsulta(res, 500, { mensaje: "Error al consultar el certificado.", tipo: "error" });
  }
});

certificadosRouter.get("/certificados/:id", requireStaff, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(404).send("Certificado no encontrado.");
  }

  try {
    const estudiante = await Estudiantes.buscarPorId(id);
    if (!estudiante) return res.status(404).send("Participante no encontrado.");

    if (!estudiante.asistio) {
      return renderConsulta(res, 403, {
        mensaje: "No es posible emitir el certificado: la asistencia no está confirmada.",
        tipo: "error",
      });
    }

    return renderCertificado(res, 200, estudiante);
  } catch (error) {
    console.error("[certificados/:id]", error.message);
    return res.status(500).send("Error al generar el certificado.");
  }
});

// Enlace público firmado (INT-2, /c/:token)
certificadosRouter.get("/c/:token", async (req, res) => {
  const payload = readCertificateToken(req.params.token);
  if (!payload) return res.status(404).send("Certificado no encontrado o enlace vencido.");

  try {
    const estudiante = await Estudiantes.buscarPorId(Number(payload.sid));
    if (!estudiante || !estudiante.asistio) {
      return res.status(404).send("Certificado no disponible.");
    }
    return renderCertificado(res, 200, estudiante, { publico: true });
  } catch (error) {
    console.error("[c/:token]", error.message);
    return res.status(500).send("Error al generar el certificado.");
  }
});

// El navegador genera el PDF con html2pdf y lo sube a Neon Object Storage.
certificadosRouter.post(
  "/certificados/:id/pdf",
  requireStaff,
  raw({ type: "application/pdf", limit: "15mb" }),
  async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(422).json({ ok: false, mensaje: "Identificador inválido." });
    }

    if (!verifyCsrf(req)) {
      return res.status(403).json({ ok: false, mensaje: "Token de seguridad inválido." });
    }

    if (!Buffer.isBuffer(req.body) || req.body.subarray(0, 5).toString() !== "%PDF-") {
      return res.status(415).json({ ok: false, mensaje: "Se esperaba un PDF válido." });
    }

    try {
      const estudiante = await Estudiantes.buscarPorId(id);
      if (!estudiante) return res.status(404).json({ ok: false, mensaje: "Participante no encontrado." });
      if (!estudiante.asistio) {
        return res.status(403).json({ ok: false, mensaje: "Asistencia no confirmada." });
      }

      const key = await subirCertificado(id, req.body);
      await query(
        `INSERT INTO certificados (estudiante_id, bucket, object_key, size_bytes)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (estudiante_id) DO UPDATE
            SET bucket = EXCLUDED.bucket,
                object_key = EXCLUDED.object_key,
                size_bytes = EXCLUDED.size_bytes,
                created_at = now()`,
        [id, process.env.FORO_BUCKET ?? "certificados", key, req.body.length],
      );

      const url = await urlCertificado(key);
      return res.status(201).json({ ok: true, key, size: req.body.length, url });
    } catch (error) {
      console.error("[certificados/pdf]", error.message);
      return res.status(500).json({ ok: false, mensaje: "No se pudo guardar el PDF." });
    }
  },
);

// Descarga / genera URL firmada del PDF guardado
certificadosRouter.get("/certificados/:id/pdf", requireStaff, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).send("Certificado no encontrado.");

  try {
    const { rows } = await query(
      "SELECT object_key FROM certificados WHERE estudiante_id = $1 LIMIT 1",
      [id],
    );
    if (!rows[0]) return res.status(404).send("Todavía no hay un PDF guardado.");

    if (isAjax(req)) {
      return res.json({ ok: true, key: rows[0].object_key, url: await urlCertificado(rows[0].object_key) });
    }
    return res.redirect(await urlCertificado(rows[0].object_key));
  } catch (error) {
    console.error("[certificados/pdf:get]", error.message);
    return res.status(500).send("Error al leer el PDF.");
  }
});

// Mensaje del certificado generado por el AI Gateway (se guarda en Postgres)
certificadosRouter.post("/api/ai/mensaje/:id", requireStaff, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(422).json({ ok: false, mensaje: "Identificador inválido." });
  }

  try {
    const estudiante = await Estudiantes.buscarPorId(id);
    if (!estudiante) return res.status(404).json({ ok: false, mensaje: "Participante no encontrado." });

    const ai = await generarMensaje({ nombre: estudiante.nombre, apellido: estudiante.apellido });
    if (!ai.ok) return res.status(503).json({ ok: false, ...ai });

    await query(
      `INSERT INTO certificado_mensajes (estudiante_id, mensaje, modelo, origen)
       VALUES ($1, $2, $3, 'ai')
       ON CONFLICT (estudiante_id) DO UPDATE
          SET mensaje = EXCLUDED.mensaje, modelo = EXCLUDED.modelo, origen = 'ai', created_at = now()`,
      [id, ai.mensaje, ai.modelo ?? null],
    );

    return res.json({ ok: true, ...ai });
  } catch (error) {
    console.error("[api/ai/mensaje]", error.message);
    return res.status(500).json({ ok: false, mensaje: "Error al generar el mensaje." });
  }
});

// Enlace público para probar sin sesión desde la app
certificadosRouter.get("/api/certificados/:id/enlace", requireStaff, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return res.status(422).json({ ok: false });
  return res.json({
    ok: true,
    token: createCertificateToken(id),
    url: `/c/${createCertificateToken(id)}`,
  });
});
