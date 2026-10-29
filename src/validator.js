const NOMBRE_RE = /^[\p{L}'-]+$/u;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const clean = (value) =>
  String(value ?? "")
    .trim()
    .replace(/[\x00-\x1F\x7F]/gu, "");

const TIPOS_INSTITUCION = new Set(["universidad", "empresa", "otra"]);

/** Normaliza Sí/No sin distinguir mayúsculas ni tildes. */
function normalizarSiNo(value) {
  const val = clean(value)
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (["si", "s", "true", "1"].includes(val)) return "si";
  if (["no", "n", "false", "0"].includes(val)) return "no";
  return "";
}

const titleCase = (value) =>
  value.toLocaleLowerCase("es").replace(/(^|[\s'-])(\p{L})/gu, (_, sep, letra) => sep + letra.toUpperCase());

export function validateRegistro(input) {
  const errores = {};
  const data = {};

  const cedulaNorm = clean(input.cedula).replace(/\D+/g, "");
  if (!/^[0-9]{6,10}$/.test(cedulaNorm)) {
    errores.cedula = "La cédula debe contener solo números (entre 6 y 10 dígitos).";
  } else {
    data.cedula = cedulaNorm;
  }

  const nombre = clean(input.nombre);
  if (nombre.length < 2 || nombre.length > 30) {
    errores.nombre = "El primer nombre debe tener entre 2 y 30 caracteres.";
  } else if (!NOMBRE_RE.test(nombre) || nombre.includes(" ")) {
    errores.nombre = "Solo primer nombre: únicamente letras (sin espacios ni números).";
  } else {
    data.nombre = titleCase(nombre);
  }

  const apellido = clean(input.apellido);
  if (apellido.length < 2 || apellido.length > 30) {
    errores.apellido = "El primer apellido debe tener entre 2 y 30 caracteres.";
  } else if (!NOMBRE_RE.test(apellido) || apellido.includes(" ")) {
    errores.apellido = "Solo primer apellido: únicamente letras (sin espacios ni números).";
  } else {
    data.apellido = titleCase(apellido);
  }

  const fechaNacimiento = clean(input.fecha_nacimiento);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento)) {
    errores.fecha_nacimiento = "La fecha de nacimiento es obligatoria (AAAA-MM-DD).";
  } else {
    const fecha = new Date(`${fechaNacimiento}T00:00:00Z`);
    const valida = !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === fechaNacimiento;
    if (!valida) {
      errores.fecha_nacimiento = "La fecha de nacimiento no es válida.";
    } else {
      const hoy = new Date();
      const hoyUTC = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
      if (fecha > hoyUTC) {
        errores.fecha_nacimiento = "La fecha de nacimiento no puede ser futura.";
      } else {
        let edad = hoyUTC.getUTCFullYear() - fecha.getUTCFullYear();
        const m = hoyUTC.getUTCMonth() - fecha.getUTCMonth();
        if (m < 0 || (m === 0 && hoyUTC.getUTCDate() < fecha.getUTCDate())) edad -= 1;
        if (edad < 12 || edad > 100) {
          errores.fecha_nacimiento = "La edad debe estar entre 12 y 100 años.";
        } else {
          data.fecha_nacimiento = fechaNacimiento;
          data.edad = edad;
        }
      }
    }
  }

  const correo = clean(input.correo).toLowerCase();
  if (!EMAIL_RE.test(correo)) {
    errores.correo = "El correo electrónico no es válido.";
  } else if (correo.length > 150) {
    errores.correo = "El correo electrónico es demasiado largo.";
  } else {
    data.correo = correo;
  }

  const telefonoNorm = clean(input.telefono).replace(/\D+/g, "");
  if (!/^[0-9]{7,15}$/.test(telefonoNorm)) {
    errores.telefono = "El teléfono debe contener solo números (entre 7 y 15 dígitos).";
  } else {
    data.telefono = telefonoNorm;
  }

  validarInstitucion(input, errores, data);

  return { ok: Object.keys(errores).length === 0, errores, data };
}

/**
 * Procedencia del participante (delta 2.0).
 * - "no" o vacío: institution_type = no_indico, name por defecto.
 * - "si": exige tipo válido y nombre de 2 a 150 caracteres.
 */
export function validarInstitucion(input, errores = {}, data = {}) {
  const viene = normalizarSiNo(input.viene_institucion);

  if (viene !== "si") {
    data.viene_institucion = "no";
    data.institution_type = "no_indico";
    data.institution_name = "No indicó institución";
    return { errores, data };
  }

  data.viene_institucion = "si";

  const tipo = clean(input.institution_type).toLocaleLowerCase("es");
  if (!TIPOS_INSTITUCION.has(tipo)) {
    errores.institution_type = "Seleccione el tipo de institución.";
  } else {
    data.institution_type = tipo;
  }

  const nombre = clean(input.institution_name).replace(/\s+/g, " ");
  if (nombre.length < 2 || nombre.length > 150) {
    errores.institution_name = "El nombre de la institución debe tener entre 2 y 150 caracteres.";
  } else {
    data.institution_name = nombre;
  }

  return { errores, data };
}
