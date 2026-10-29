import { Router } from "express";
import multer from "multer";
import { EVENTO } from "../config.js";
import { isAjax, verifyCsrf } from "../auth.js";
import { validateRegistro } from "../validator.js";
import * as Estudiantes from "../models/estudiantes.js";

export const registroRouter = Router();
const form = multer().none();

function render(res, status, extra = {}) {
  return res.status(status).render("registro/index", {
    title: "Registro de Participantes",
    page: "registro",
    mensaje: null,
    tipo: null,
    old: {},
    errores: {},
    ...extra,
    evento: EVENTO,
    hoy: new Date().toISOString().slice(0, 10),
  });
}

registroRouter.get("/registro", (_req, res) => render(res, 200));

registroRouter.post("/registro", form, async (req, res) => {
  const input = {
    cedula: req.body?.cedula ?? "",
    nombre: req.body?.nombre ?? "",
    apellido: req.body?.apellido ?? "",
    fecha_nacimiento: req.body?.fecha_nacimiento ?? "",
    correo: req.body?.correo ?? "",
    telefono: req.body?.telefono ?? "",
    viene_institucion: req.body?.viene_institucion ?? "",
    institution_type: req.body?.institution_type ?? "",
    institution_name: req.body?.institution_name ?? "",
  };

  if (!verifyCsrf(req)) {
    const mensaje = "Token de seguridad inválido. Recargue la página.";
    if (isAjax(req)) return res.status(403).json({ ok: false, mensaje, errores: {} });
    return render(res, 403, { mensaje, tipo: "error", old: input });
  }

  const { ok, errores, data } = validateRegistro(input);

  if (!ok) {
    const mensaje = "Revise los campos del formulario.";
    if (isAjax(req)) {
      return res.status(422).json({ ok: false, mensaje, errores });
    }
    return render(res, 422, { mensaje, tipo: "error", old: input, errores });
  }

  try {
    if (await Estudiantes.existePorCedula(data.cedula)) {
      const mensaje = "Ya existe un participante registrado con esa cédula.";
      if (isAjax(req)) {
        return res.status(409).json({
          ok: false,
          mensaje,
          errores: { cedula: "Esta cédula ya está registrada." },
        });
      }
      return render(res, 409, {
        mensaje,
        tipo: "error",
        old: input,
        errores: { cedula: "Esta cédula ya está registrada." },
      });
    }

    const id = await Estudiantes.crear(data);
    const mensaje = `Registro exitoso. Su número de inscripción es #${id}.`;

    if (isAjax(req)) return res.status(201).json({ ok: true, mensaje, id });
    return render(res, 201, { mensaje, tipo: "success" });
  } catch (error) {
    console.error("[registro]", error.message);
    const mensaje =
      error.code === "23505"
        ? "Ya existe un registro con esa cédula."
        : "Ocurrió un error inesperado al procesar el registro.";
    if (isAjax(req)) return res.status(500).json({ ok: false, mensaje, errores: {} });
    return render(res, 500, { mensaje, tipo: "error", old: input });
  }
});
