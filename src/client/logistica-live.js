import { createRealtimeClient } from "@neon/realtime/client";

// Suscripción en vivo del panel de logística (Neon Realtime).
// El HTML trae data-live="1" y <meta name="neon-realtime-url"> sólo cuando el
// servicio está configurado; si algo falla, app.js mantiene el polling de 15 s.

const RENEW_EARLY_MS = 10_000;
const RETRY_MS = 1_000;

const tabla = document.getElementById("tabla-asistencia");
const meta = document.querySelector('meta[name="neon-realtime-url"]');

if (tabla && tabla.dataset.live === "1" && meta?.content) {
  iniciar(meta.content).catch((error) => {
    console.warn("[realtime] no disponible:", error.message);
  });
}

async function fetchSealed() {
  const response = await fetch("/logistica/live", {
    headers: { accept: "application/json", "x-requested-with": "XMLHttpRequest" },
  });
  if (!response.ok) throw new Error(`/logistica/live respondió ${response.status}`);
  const data = await response.json();
  if (!data?.ok || !data.sealed) throw new Error(data?.mensaje ?? "sealed query ausente");
  return data.sealed;
}

function normalizar(row) {
  return {
    id: Number(row.id),
    cedula: String(row.cedula),
    nombre: String(row.nombre),
    apellido: String(row.apellido),
    correo: String(row.correo),
    telefono: String(row.telefono),
    institution_name: String(row.institution_name ?? "No indicó institución"),
    institution_type: String(row.institution_type ?? "no_indico"),
    asistio: Boolean(row.asistio),
    fecha_registro: row.fecha_registro,
  };
}

function emitir(snapshot) {
  const status = snapshot.status;
  window.__foroLiveConnected = status === "live" || status === "stale";

  if (!Array.isArray(snapshot.data)) return;
  const estudiantes = snapshot.data.map(normalizar);

  window.dispatchEvent(
    new CustomEvent("foro:estudiantes", {
      detail: {
        status,
        estudiantes,
        total: estudiantes.length,
        asistentes: estudiantes.filter((e) => e.asistio).length,
        asistencia_habilitada: tabla.dataset.asistencia === "1",
      },
    }),
  );
}

async function iniciar(url) {
  const client = createRealtimeClient({ url });
  const sealed = await fetchSealed();
  const subscription = client.subscribe(sealed);

  subscription.onChange(emitir);
  subscription.onStateChange((state) => {
    window.__foroLiveConnected = state.status === "live" || state.status === "stale";
    if (state.status === "error") {
      console.warn("[realtime]", state.error?.message ?? "error");
      window.__foroLiveConnected = false;
    }
  });

  const stopRenewing = renewBeforeExpiry(subscription, sealed, fetchSealed);

  window.addEventListener("beforeunload", () => {
    stopRenewing();
    subscription.unsubscribe();
    client.close();
  });
}

function renewBeforeExpiry(subscription, sealedQuery, fetchSealedQuery) {
  let timer;
  let stopped = false;

  function schedule(delay) {
    clearTimeout(timer);
    if (!stopped) timer = setTimeout(renew, delay);
  }

  function scheduleBeforeExpiry(expiresAt) {
    schedule(Math.max(0, expiresAt - Date.now() - RENEW_EARLY_MS));
  }

  async function renew() {
    let next;
    try {
      next = await fetchSealedQuery();
    } catch {
      schedule(RETRY_MS);
      return;
    }
    scheduleBeforeExpiry(next.expiresAt);
    subscription.renew(next).catch((error) => {
      console.warn("[realtime] renovación rechazada:", error.message);
      stopped = true;
      clearTimeout(timer);
    });
  }

  function stop() {
    stopped = true;
    clearTimeout(timer);
  }

  scheduleBeforeExpiry(sealedQuery.expiresAt);
  return stop;
}
