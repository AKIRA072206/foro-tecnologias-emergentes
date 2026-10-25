import { query } from "../db.js";

// fecha_registro se serializa como texto local (sin Z) para que el navegador
// no aplique el desfase UTC de 4 h al formatear la fecha.
const CAMPOS = `id, cedula, nombre, apellido,
                to_char(fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
                edad, correo, telefono, asistio,
                to_char(fecha_registro, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_registro`;

export async function existePorCedula(cedula) {
  const { rows } = await query("SELECT 1 FROM estudiantes WHERE cedula = $1 LIMIT 1", [cedula]);
  return rows.length > 0;
}

export async function crear(data) {
  const { rows } = await query(
    `INSERT INTO estudiantes (cedula, nombre, apellido, fecha_nacimiento, edad, correo, telefono)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      data.cedula,
      data.nombre,
      data.apellido,
      data.fecha_nacimiento,
      data.edad,
      data.correo,
      data.telefono,
    ],
  );
  return Number(rows[0].id);
}

export async function listarTodos() {
  const { rows } = await query(`SELECT ${CAMPOS} FROM estudiantes ORDER BY apellido ASC, nombre ASC`);
  return rows;
}

export async function buscarPorId(id) {
  const { rows } = await query(`SELECT ${CAMPOS} FROM estudiantes WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function buscarPorCedula(cedula) {
  const { rows } = await query(`SELECT ${CAMPOS} FROM estudiantes WHERE cedula = $1 LIMIT 1`, [cedula]);
  return rows[0] ?? null;
}

/** UPDATE atómico: sólo pasa a TRUE si todavía estaba en FALSE. */
export async function confirmarAsistencia(id) {
  const { rows } = await query(
    `UPDATE estudiantes
        SET asistio = true
      WHERE id = $1 AND asistio = false
      RETURNING id, asistio,
                pg_current_xact_id()::text AS txid`,
    [id],
  );
  return rows[0] ?? null;
}
