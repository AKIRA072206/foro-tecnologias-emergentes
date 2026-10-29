import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const { Client } = pg;

const schemaPath = path.join(process.cwd(), "database", "neon_schema.sql");
const seed = [
  {
    id: 1,
    cedula: "28259274",
    nombre: "Francismar",
    apellido: "Sanblas",
    fecha_nacimiento: "2000-08-15",
    edad: 26,
    correo: "francismar.sbr@gmail.com",
    telefono: "04126778846",
    asistio: true,
    fecha_registro: "2026-10-19 20:01:00.654458",
  },
  {
    id: 2,
    cedula: "17458428",
    nombre: "Nerson",
    apellido: "Gimenez",
    fecha_nacimiento: "1981-03-19",
    edad: 45,
    correo: "nersongimenez@gmail.com",
    telefono: "04121541653",
    asistio: true,
    fecha_registro: "2026-10-19 20:07:53.409489",
  },
];

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Falta DATABASE_URL_UNPOOLED / DATABASE_URL en .env.local");
  process.exit(1);
}

const client = new Client({ connectionString, connectionTimeoutMillis: 20_000 });

try {
  await client.connect();
  console.log("[migrate] conectado a Neon");

  const sql = fs.readFileSync(schemaPath, "utf8");
  await client.query(sql);
  console.log("[migrate] esquema aplicado:", path.relative(process.cwd(), schemaPath));

  // Migraciones incrementales e idempotentes sobre bases ya existentes.
  const migraciones = ["migrate_institucion.sql"];
  for (const archivo of migraciones) {
    const ruta = path.join(process.cwd(), "database", archivo);
    if (!fs.existsSync(ruta)) continue;
    await client.query(fs.readFileSync(ruta, "utf8"));
    console.log("[migrate] migración aplicada:", archivo);
  }

  if (process.argv.includes("--seed")) {
    for (const row of seed) {
      await client.query(
        `INSERT INTO estudiantes
           (id, cedula, nombre, apellido, fecha_nacimiento, edad, correo, telefono, asistio, fecha_registro)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (cedula) DO NOTHING`,
        [
          row.id,
          row.cedula,
          row.nombre,
          row.apellido,
          row.fecha_nacimiento,
          row.edad,
          row.correo,
          row.telefono,
          row.asistio,
          row.fecha_registro,
        ],
      );
    }
    await client.query(
      "SELECT setval(pg_get_serial_sequence('estudiantes','id'), COALESCE((SELECT MAX(id) FROM estudiantes), 1))",
    );
    console.log(`[migrate] seed aplicado (${seed.length} filas)`);
  }

  const { rows } = await client.query(`
    SELECT (SELECT count(*)::int FROM estudiantes) AS estudiantes,
           (SELECT count(*)::int FROM certificado_envios) AS envios,
           (SELECT count(*)::int FROM certificados) AS certificados,
           (SELECT count(*)::int FROM certificado_mensajes) AS mensajes
  `);
  console.log("[migrate] conteos:", rows[0]);
} catch (error) {
  console.error("[migrate] error:", error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
