import app from "./app.js";
import { EVENTO } from "./config.js";

// Solo escuchar localmente (no en serverless/Vercel)
// En Vercel, el servidor es invocado por el handler de HTTP
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT ?? 3000;
  const server = app.listen(PORT, () => {
    console.log(`[foro] ${EVENTO.titulo}`);
    console.log(`[foro] escuchando en http://localhost:${PORT} (desarrollo)`);
    console.log(`[foro] rama Neon: ${process.env.NEON_BRANCH ?? "(no configurada)"}`);
  });

  async function shutdown(signal) {
    console.log(`[foro] ${signal}: cerrando…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

export default app;
