/**
 * Prueba end-to-end de los seis servicios de Neon cableados al foro.
 *
 *   node scripts/e2e.mjs
 *
 * Requiere el servidor en http://localhost:3000 (`npm start`).
 */
import dotenv from "dotenv";
import pg from "pg";
import { createRealtimeClient } from "@neon/realtime/client";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const { Client } = pg;
const BASE = process.env.FORO_BASE_URL ?? "http://localhost:3000";
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(name, condition, detail = "") {
  record(name, Boolean(condition), detail);
  if (!condition) throw new Error(`Falló: ${name} ${detail}`);
}

class Jar {
  constructor() {
    this.cookies = new Map();
  }
  store(response) {
    const list = response.headers.getSetCookie?.() ?? [];
    for (const cookie of list) {
      const [pair] = cookie.split(";");
      const index = pair.indexOf("=");
      if (index > 0) this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  clear() {
    this.cookies.clear();
  }
}

async function req(jar, path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (jar && jar.cookies.size) headers.cookie = jar.header();
  const response = await fetch(`${BASE}${path}`, { ...options, headers, redirect: "manual" });
  jar?.store(response);
  return response;
}

function csrfFrom(html) {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  return match?.[1] ?? "";
}

async function main() {
  const jar = new Jar();

  // ── Registro público (Postgres) ─────────────────────────────
  const registroPage = await req(jar, "/registro");
  const registroHtml = await registroPage.text();
  assert("GET /registro → 200 con formulario", registroPage.status === 200 && registroHtml.includes("form-registro"));

  const csrfRegistro = csrfFrom(registroHtml);
  if (!csrfRegistro) throw new Error("No se encontró el token CSRF del registro");

  const stamp = String(Date.now()).slice(-7);
  const cedula = `9${stamp}`;
  const correo = `e2e-${stamp}@foro.test`;

  const form = new FormData();
  form.set("_csrf", csrfRegistro);
  form.set("cedula", cedula);
  form.set("nombre", "Prueba");
  form.set("apellido", "Automatica");
  form.set("fecha_nacimiento", "2000-05-10");
  form.set("correo", correo);
  form.set("telefono", "04141234567");

  const created = await req(jar, "/registro", {
    method: "POST",
    headers: { accept: "application/json", "x-requested-with": "XMLHttpRequest" },
    body: form,
  });
  const createdData = await created.json().catch(() => ({}));
  assert("POST /registro crea participante", created.status === 201 && createdData.ok, `id=${createdData.id} cedula=${cedula}`);
  const estudianteId = createdData.id;

  const duplicate = await req(jar, "/registro", {
    method: "POST",
    headers: { accept: "application/json", "x-requested-with": "XMLHttpRequest" },
    body: (() => {
      const dup = new FormData();
      dup.set("_csrf", csrfRegistro);
      dup.set("cedula", cedula);
      dup.set("nombre", "Prueba");
      dup.set("apellido", "Automatica");
      dup.set("fecha_nacimiento", "2000-05-10");
      dup.set("correo", correo);
      dup.set("telefono", "04141234567");
      return dup;
    })(),
  });
  assert("POST /registro rechaza cédula duplicada", duplicate.status === 409, `status=${duplicate.status}`);

  // ── Login del personal (Neon Auth con respaldo local) ───────
  const loginPage = await req(jar, "/login");
  const loginHtml = await loginPage.text();
  assert("GET /login → 200", loginPage.status === 200 && loginHtml.includes('name="usuario"'));

  const csrfLogin = csrfFrom(loginHtml);
  const login = await req(jar, "/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      _csrf: csrfLogin,
      usuario: process.env.FORO_USER ?? "logistica",
      password: process.env.FORO_PASS ?? "foro2026",
    }),
  });
  const provider = login.headers.get("x-auth-provider");
  assert(
    "POST /login crea sesión (Neon Auth)",
    login.status === 302 && login.headers.get("location") === "/logistica" && provider === "neon-auth",
    `status=${login.status} provider=${provider}`,
  );

  const logistica = await req(jar, "/logistica");
  const logisticaHtml = await logistica.text();
  assert("GET /logistica autenticado → 200", logistica.status === 200 && logisticaHtml.includes("Panel de logística"));
  const csrfStaff = logisticaHtml.match(/id="csrf-logistica" value="([^"]+)"/)?.[1] ?? csrfFrom(logisticaHtml);

  const lista = await req(jar, "/logistica/lista", {
    headers: { accept: "application/json", "x-requested-with": "XMLHttpRequest" },
  });
  const listaData = await lista.json();
  assert("GET /logistica/lista → JSON desde Postgres", lista.ok && listaData.ok && listaData.total >= 3, `total=${listaData.total}`);

  // ── Neon Realtime: sealed query + suscripción viva ──────────
  const live = await req(jar, "/logistica/live", {
    headers: { accept: "application/json", "x-requested-with": "XMLHttpRequest" },
  });
  const liveData = await live.json();
  assert(
    "GET /logistica/live sella la query",
    live.status === 200 && liveData.ok && Boolean(liveData.sealed?.queryFingerprint || liveData.sealed?.expiresAt),
    `expiresAt=${liveData.sealed?.expiresAt ?? "?"}`,
  );

  let realtimeOk = false;
  let realtimeDetail = "";
  const sealed = liveData.sealed;
  const client = createRealtimeClient({ url: process.env.NEON_REALTIME_URL });
  const subscription = client.subscribe(sealed);

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout esperando estado live")), 25_000);
      subscription.onStateChange((state) => {
        if (state.status === "live") {
          clearTimeout(timer);
          resolve();
        }
        if (state.status === "error") {
          clearTimeout(timer);
          reject(new Error(state.error?.message ?? "error de suscripción"));
        }
      });
    });

    const initial = subscription.getSnapshot?.();
    realtimeDetail = `filas=${initial?.data?.length ?? 0}`;

    const dbRealtime = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
    await dbRealtime.connect();
    const nuevoTelefono = "04149998877";
    const cambio = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout esperando el cambio en vivo")), 25_000);
      subscription.onChange((snapshot) => {
        const fila = (snapshot.data ?? []).find((row) => Number(row.id) === Number(estudianteId));
        if (fila?.telefono === nuevoTelefono) {
          clearTimeout(timer);
          resolve(fila);
        }
      });
    });
    await dbRealtime.query("UPDATE estudiantes SET telefono = $1 WHERE id = $2", [nuevoTelefono, estudianteId]);
    await cambio;
    await dbRealtime.end();
    realtimeOk = true;
    realtimeDetail += ", cambio propagado";
  } catch (error) {
    realtimeDetail = error.message;
  } finally {
    subscription.unsubscribe();
    client.close();
  }
  record("Neon Realtime propaga un cambio en vivo", realtimeOk, realtimeDetail);

  // ── Asistencia + pipeline posterior (AI/Function/Postgres) ──
  const asistencia = await req(jar, "/logistica/asistencia", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-requested-with": "XMLHttpRequest",
    },
    body: JSON.stringify({ id: estudianteId, asistio: true, _csrf: csrfStaff }),
  });
  const asistenciaData = await asistencia.json();
  assert("POST /logistica/asistencia confirma (UPDATE atómico)", asistencia.ok && asistenciaData.ok, `txid=${asistenciaData.data?.txid ?? "?"}`);

  const repetida = await req(jar, "/logistica/asistencia", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-requested-with": "XMLHttpRequest",
    },
    body: JSON.stringify({ id: estudianteId, asistio: true, _csrf: csrfStaff }),
  });
  assert("Segunda confirmación se bloquea (409)", repetida.status === 409, `status=${repetida.status}`);

  // Verificación directa en Postgres del trabajo en background
  const db = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
  await db.connect();
  let envio = null;
  let mensaje = null;
  for (let intento = 0; intento < 30; intento += 1) {
    const { rows } = await db.query(
      `SELECT e.estado, e.intentos, e.ultimo_error, m.mensaje, m.origen, m.modelo
         FROM certificado_envios e
         LEFT JOIN certificado_mensajes m ON m.estudiante_id = e.estudiante_id
        WHERE e.estudiante_id = $1`,
      [estudianteId],
    );
    if (rows[0]?.estado && rows[0]?.mensaje) {
      envio = rows[0];
      mensaje = rows[0];
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert("Postgres registra el outbox de envío", Boolean(envio), `estado=${envio?.estado ?? "sin fila"}`);
  assert(
    "NEON Function procesa la notificación",
    Boolean(envio) && ["pendiente", "enviado"].includes(envio.estado),
    `estado=${envio?.estado} motivo=${envio?.ultimo_error ?? "—"}`,
  );
  assert(
    "Mensaje del certificado guardado (AI o respaldo)",
    Boolean(mensaje?.mensaje),
    `origen=${mensaje?.origen ?? "?"} modelo=${mensaje?.modelo ?? "—"}`,
  );

  // ── Certificado + Object Storage ────────────────────────────
  const cert = await req(jar, `/certificados/${estudianteId}`);
  const certHtml = await cert.text();
  assert("GET /certificados/:id → 200", cert.status === 200 && certHtml.includes("CERTIFICADO DE ASISTENCIA"));

  const pdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
    "utf8",
  );
  const upload = await req(jar, `/certificados/${estudianteId}/pdf`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/pdf",
      "x-csrf-token": csrfStaff,
    },
    body: pdf,
  });
  const uploadData = await upload.json().catch(() => ({}));
  assert(
    "POST /certificados/:id/pdf sube a Object Storage",
    upload.status === 201 && uploadData.ok,
    `key=${uploadData.key ?? "?"} size=${uploadData.size ?? "?"}`,
  );

  if (uploadData.url) {
    const descarga = await fetch(uploadData.url);
    const tipo = descarga.headers.get("content-type") ?? "";
    const bytes = Buffer.from(await descarga.arrayBuffer());
    assert(
      "URL firmada del bucket devuelve el PDF",
      descarga.ok && tipo.includes("pdf") && bytes.subarray(0, 5).toString() === "%PDF-",
      `status=${descarga.status} type=${tipo} bytes=${bytes.length}`,
    );
  }

  const enlace = await req(jar, `/api/certificados/${estudianteId}/enlace`, {
    headers: { accept: "application/json" },
  });
  const enlaceData = await enlace.json();
  const publico = await fetch(`${BASE}${enlaceData.url}`, { redirect: "manual" });
  const publicoHtml = await publico.text();
  assert(
    "Enlace público /c/:token sirve el certificado",
    publico.status === 200 && publicoHtml.includes("CERTIFICADO DE ASISTENCIA"),
    `status=${publico.status}`,
  );

  // ── Estado de los seis servicios ────────────────────────────
  const estado = await req(jar, "/api/servicios/estado", { headers: { accept: "application/json" } });
  const estadoData = await estado.json();
  console.log("\n[servicios]", JSON.stringify(estadoData, null, 2));

  assert("Postgres responde", estadoData.database?.ok, `db=${estadoData.database?.db}`);
  assert("Neon Auth responde", estadoData.auth?.ok, `status=${estadoData.auth?.status}`);
  assert("Object Storage responde (HeadBucket)", estadoData.storage?.ok, `bucket=${estadoData.storage?.bucket}`);
  assert("Neon Functions responde", estadoData.functions?.ok, JSON.stringify(estadoData.functions));
  assert("Neon Realtime configurado", estadoData.realtime?.ok, estadoData.realtime?.url ?? "");
  record(
    "AI Gateway operativo",
    Boolean(estadoData.aiGateway?.ok),
    estadoData.aiGateway?.ok
      ? `modelos=${estadoData.aiGateway?.total}`
      : `bloqueado: ${estadoData.aiGateway?.motivo ?? "sin detalle"}`,
  );

  // ── Logout ─────────────────────────────────────────────────
  const logout = await req(jar, "/logout");
  const trasLogout = await req(jar, "/logistica");
  assert(
    "Logout invalida la sesión",
    logout.status === 302 && trasLogout.status === 302 && trasLogout.headers.get("location") === "/login",
    `logout=${logout.status} logistica=${trasLogout.status}`,
  );

  await db.end();
}

main()
  .then(() => {
    const fallos = results.filter((r) => !r.ok);
    console.log(`\nResultado: ${results.length - fallos.length}/${results.length} pruebas OK`);
    if (fallos.length) {
      console.log("Fallos:");
      for (const fallo of fallos) console.log(` - ${fallo.name}: ${fallo.detail}`);
    }
    process.exit(fallos.length ? 1 : 0);
  })
  .catch((error) => {
    console.error("\n[e2e] abortado:", error.message);
    process.exit(1);
  });
