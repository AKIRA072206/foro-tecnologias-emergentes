import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import dotenv from "dotenv";

// Carga .env.local primero (lo escribe `neon env pull`), .env como respaldo.
const root = path.resolve(process.cwd());
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const { Client } = pg;

const VALID_INSTITUTION_TYPES = new Set([
  "universidad",
  "empresa",
  "otra",
  "no_indico",
]);

// Ruta del JSON: argumento --archivo=..., FORO_IMPORTAR_JSON, o default scripts/estudiantes.json
const argArchivo = process.argv.find((a) => a.startsWith("--archivo="));
const jsonPath = argArchivo
  ? argArchivo.slice("--archivo=".length)
  : process.env.FORO_IMPORTAR_JSON ??
    path.join(process.cwd(), "scripts", "estudiantes.json");

const connectionString =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "Falta DATABASE_URL_UNPOOLED / DATABASE_URL en .env.local o .env"
  );
  process.exit(1);
}

// ---------- Validaciones del esquema (database/neon_schema.sql) ----------
const reCedula = /^[0-9]{6,10}$/;
const reNombre = /^[A-Za-zÀ-ÿ\u00f1\u00d1'\-]+$/u; // letras latinas (con acento/ñ), apóstrofo y guion
const reCorreo =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const reTelefono = /^[0-9]{7,15}$/;

function validarEstudiante(e, idx) {
  const errores = [];
  const ced = String(e.cedula ?? "").trim();
  const nom = String(e.nombre ?? "").trim();
  const ape = String(e.apellido ?? "").trim();
  const cor = String(e.correo ?? "").trim();
  const tel = String(e.telefono ?? "").trim();
  const instType = String(e.institution_type ?? "no_indico").trim();

  if (!ced || !reCedula.test(ced))
    errores.push(`cedula inválida "${ced}"`);
  if (!nom || nom.length < 2 || nom.length > 30 || !reNombre.test(nom))
    errores.push(`nombre inválido "${nom}"`);
  if (!ape || ape.length < 2 || ape.length > 30 || !reNombre.test(ape))
    errores.push(`apellido inválido "${ape}"`);
  if (!cor || !reCorreo.test(cor)) errores.push(`correo inválido "${cor}"`);
  if (!tel || !reTelefono.test(tel)) errores.push(`telefono inválido "${tel}"`);
  if (
    e.edad === undefined ||
    e.edad === null ||
    Number.isNaN(Number(e.edad)) ||
    Number(e.edad) < 0 ||
    Number(e.edad) > 120
  )
    errores.push(`edad inválida "${e.edad}"`);
  if (!VALID_INSTITUTION_TYPES.has(instType))
    errores.push(`institution_type inválido "${instType}"`);

  return errores;
}

const client = new Client({ connectionString, connectionTimeoutMillis: 30_000 });

let leidos = 0;
let insertados = 0;
let omitidos = 0;
let errores = 0;
const detallesError = [];

try {
  await client.connect();
  console.log("[importar_json] conectado a Neon");

  if (!fs.existsSync(jsonPath)) {
    console.error(`[importar_json] no se encontró el archivo: ${jsonPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, "utf8");
  let datos;
  try {
    datos = JSON.parse(raw);
  } catch (err) {
    console.error(`[importar_json] JSON inválido: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(datos)) {
    console.error("[importar_json] el JSON raíz debe ser un array de estudiantes");
    process.exit(1);
  }

  leidos = datos.length;
  console.log(`[importar_json] ${leidos} registro(s) leído(s) de ${jsonPath}`);

  for (const e of datos) {
    const filaErr = validarEstudiante(e, leidos);
    if (filaErr.length > 0) {
      errores++;
      detallesError.push({ cedula: e.cedula, errores: filaErr });
      console.warn(
        `[importar_json] omitido por validación: ${e.cedula} -> ${filaErr.join(", ")}`
      );
      continue;
    }

    try {
      const { rows } = await client.query(
        `INSERT INTO estudiantes
           (cedula, nombre, apellido, fecha_nacimiento, edad, correo, telefono,
            institution_name, institution_type, asistio, fecha_registro)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (cedula) DO NOTHING
         RETURNING id, cedula`,
        [
          String(e.cedula).trim(),
          String(e.nombre).trim(),
          String(e.apellido).trim(),
          e.fecha_nacimiento || null,
          Number(e.edad),
          String(e.correo).trim(),
          String(e.telefono).trim(),
          String(e.institution_name ?? "No indicó institución").trim(),
          String(e.institution_type ?? "no_indico").trim(),
          Boolean(e.asistio) === true,
          e.fecha_registro || null,
        ]
      );

      if (rows.length > 0) {
        insertados++;
      } else {
        omitidos++; // ya existía por cédula (idempotencia)
        console.log(`[importar_json] ya existía (omitido): ${e.cedula}`);
      }
    } catch (err) {
      errores++;
      detallesError.push({ cedula: e.cedula, errores: [err.message] });
      console.error(
        `[importar_json] error insertando ${e.cedula}: ${err.message}`
      );
    }
  }

  // Ajusta el secuencer de id para no chocar con ids existentes.
  await client.query(
    `SELECT setval(pg_get_serial_sequence('estudiantes','id'),
                   COALESCE((SELECT MAX(id) FROM estudiantes), 1), true)`
  );

  // Conteo final
  const { rows } = await client.query(
    `SELECT count(*)::int AS total FROM estudiantes`
  );
  console.log(
    `[importar_json] resumen: leídos=${leidos} insertados=${insertados} omitidos(existentes)=${omitidos} errores=${errores} total_en_bd=${rows[0].total}`
  );

  if (detallesError.length > 0) {
    console.error("[importar_json] detalles de errores:", JSON.stringify(detallesError, null, 2));
  }
} catch (error) {
  console.error("[importar_json] error fatal:", error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}