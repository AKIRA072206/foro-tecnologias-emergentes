import app from "./app.js";
import { EVENTO, PORT, IS_PROD } from "./config.js";

const server = app.listen(PORT, () => {
  console.log(`[foro] ${EVENTO.titulo}`);
  console.log(`[foro] escuchando en http://localhost:${PORT} (${IS_PROD ? "producción" : "desarrollo"})`);
  console.log(`[foro] rama Neon: ${process.env.NEON_BRANCH ?? "(no configurada)"}`);
});

async function shutdown(signal) {
  console.log(`[foro] ${signal}: cerrando…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export default app;
