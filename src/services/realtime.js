import { createRealtime, rawSql } from "@neon/realtime/server";
import { NEON } from "../config.js";
import { dbName } from "../db.js";

export const realtimeConfigurado = Boolean(NEON.realtimeSecret && NEON.realtimeUrl);

const realtime = realtimeConfigurado
  ? createRealtime({
      secret: NEON.realtimeSecret,
      db: dbName(),
      debugMode: false,
    })
  : null;

/**
 * Sella el listado del panel. La query es read-only, determinista y no usa
 * funciones volátiles, como exige Realtime.
 */
export async function sellarListado() {
  if (!realtime) throw new Error("Neon Realtime no está configurado en esta rama");

  const query = rawSql(
    `SELECT id, cedula, nombre, apellido, correo, telefono, asistio, fecha_registro
       FROM estudiantes
      ORDER BY apellido ASC, nombre ASC`,
    [],
  );

  return realtime.seal({ query });
}
