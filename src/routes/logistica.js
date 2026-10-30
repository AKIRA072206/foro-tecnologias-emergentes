import { Router } from "express";
import { EVENTO, asistenciaHabilitada } from "../config.js";
import { isAjax, requireStaff, verifyCsrf, readSession } from "../auth.js";
import * as Estudiantes from "../models/estudiantes.js";
import { procesarPostAsistencia } from "../postasistencia.js";
import { realtimeConfigurado, sellarListado } from "../services/realtime.js";

export const logisticaRouter = Router();

function aBoolean(value) {
  if (typeof value === "boolean") return value;
  const val = String(value ?? "").toLowerCase();
  if (["1", "true", "yes", "on", "si", "sí"].includes(val)) return true;
  if (["0", "false", "no", "off"].includes(val)) return false;
  return null;
}

logisticaRouter.get("/logistica", requireStaff, async (req, res) => {
  let estudiantes = [];
  let error = null;

  try {
    estudiantes = await Estudiantes.listarTodos();
  } catch (err) {
    console.error("[logistica]", err.message);
    error = "No se pudieron cargar los registros. Verifique la conexión a PostgreSQL.";
  }

  return res.render("logistica/index", {
    title: "Logística",
    page: "logistica",
    estudiantes,
    error,
    eventoFecha: EVENTO.fechaTexto,
    eventoHora: EVENTO.horaTexto,
    asistenciaHabilitada: asistenciaHabilitada(),
    usuario: req.session?.usuario ?? null,
    realtime: realtimeConfigurado && Boolean(process.env.NEON_REALTIME_URL),
    realtimeUrl: process.env.NEON_REALTIME_URL ?? "",
    evento: EVENTO,
  });
});

logisticaRouter.get("/logistica/lista", requireStaff, async (_req, res) => {
  try {
    const rows = await Estudiantes.listarTodos();
    const estudiantes = rows.map((e) => ({
      id: Number(e.id),
      cedula: String(e.cedula),
      nombre: String(e.nombre),
      apellido: String(e.apellido),
      correo: String(e.correo),
      telefono: String(e.telefono),
      institution_name: String(e.institution_name ?? "No indicó institución"),
      institution_type: String(e.institution_type ?? "no_indico"),
      asistio: Boolean(e.asistio),
      fecha_registro: e.fecha_registro ?? "",
    }));

    return res.json({
      ok: true,
      asistencia_habilitada: asistenciaHabilitada(),
      total: estudiantes.length,
      asistentes: estudiantes.filter((e) => e.asistio).length,
      estudiantes,
    });
  } catch (err) {
    console.error("[logistica/lista]", err.message);
    return res.status(500).json({ ok: false, mensaje: "No se pudo obtener el listado." });
  }
});

logisticaRouter.get("/logistica/live", requireStaff, async (_req, res) => {
  try {
    const sealed = await sellarListado();
    return res.json({
      ok: true,
      sealed,
      asistencia_habilitada: asistenciaHabilitada(),
      total: 0,
      asistentes: 0,
    });
  } catch (err) {
    console.error("[logistica/live]", err.message);
    return res.status(503).json({ ok: false, mensaje: "Realtime no disponible.", detalle: err.message });
  }
});

logisticaRouter.post("/logistica/asistencia", requireStaff, async (req, res) => {
  if (!asistenciaHabilitada()) {
    return res.status(403).json({
      ok: false,
      mensaje: "El control de asistencia se habilita el día del evento (06/11/2026).",
    });
  }

  if (!verifyCsrf(req)) {
    return res.status(403).json({ ok: false, mensaje: "Token de seguridad inválido." });
  }

  const id = Number.parseInt(req.body?.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(422).json({ ok: false, mensaje: "Identificador de estudiante inválido." });
  }

  const asistio = aBoolean(req.body?.asistio);
  if (asistio === null) {
    return res.status(422).json({ ok: false, mensaje: "Valor de asistencia inválido." });
  }

  try {
    const actual = await Estudiantes.buscarPorId(id);
    if (!actual) {
      return res.status(404).json({ ok: false, mensaje: "Estudiante no encontrado." });
    }

    if (actual.asistio) {
      return res.status(409).json({
        ok: false,
        mensaje: "La asistencia ya fue confirmada y no se puede modificar.",
        data: { id, asistio: true, bloqueado: true },
      });
    }

    if (!asistio) {
      return res.json({
        ok: true,
        mensaje: "Sin cambios: la persona aún no ha sido marcada como asistente.",
        data: { id, asistio: false },
      });
    }

    const actualizado = await Estudiantes.confirmarAsistencia(id);
    if (!actualizado) {
      // Otra petición ganó la carrera
      return res.status(409).json({
        ok: false,
        mensaje: "La asistencia ya fue confirmada y no se puede modificar.",
        data: { id, asistio: true, bloqueado: true },
      });
    }

    res.json({
      ok: true,
      mensaje: "Asistencia confirmada: Sí vino. Este registro quedó bloqueado.",
      data: {
        id: Number(actualizado.id),
        asistio: Boolean(actualizado.asistio),
        bloqueado: true,
        txid: actualizado.txid,
      },
    });

    // INT-2: responder ya y procesar correo/mensaje en background.
    const origin = process.env.FORO_PUBLIC_URL ?? `${req.protocol}://${req.get("host")}`;
    setImmediate(() => {
      procesarPostAsistencia(actual, origin).catch((err) =>
        console.error("[post-asistencia]", err.message),
      );
    });
  } catch (err) {
    console.error("[asistencia]", err.message);
    return res.status(500).json({ ok: false, mensaje: "Error al actualizar la asistencia." });
  }
});

logisticaRouter.post("/logistica/eliminar", requireStaff, async (req, res) => {
  if (!verifyCsrf(req)) {
    return res.status(403).json({ ok: false, mensaje: "Token de seguridad inválido." });
  }

  const id = Number.parseInt(req.body?.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(422).json({ ok: false, mensaje: "Identificador de estudiante inválido." });
  }

  try {
    const actual = await Estudiantes.buscarPorId(id);
    if (!actual) {
      return res.status(404).json({ ok: false, mensaje: "Estudiante no encontrado." });
    }

    // INT-4 (pruebas): se permite eliminar aunque la asistencia esté marcada,
    // para facilitar la limpieza de datos de prueba.
    const borrado = await Estudiantes.eliminar(id);
    if (!borrado) {
      return res.status(404).json({ ok: false, mensaje: "Estudiante no encontrado." });
    }

    return res.json({
      ok: true,
      mensaje: `Registro de ${borrado.nombre} ${borrado.apellido} eliminado.`,
      data: { id: Number(borrado.id) },
    });
  } catch (err) {
    console.error("[eliminar]", err.message);
    return res.status(500).json({ ok: false, mensaje: "Error al eliminar el registro." });
  }
});

// Sin sesión: el JS del panel consulta esto para decidir si redirigir.
logisticaRouter.get("/logistica/sesion", (req, res) => {
  const session = readSession(req);
  res.json({ ok: Boolean(session), usuario: session?.usuario ?? null });
});
