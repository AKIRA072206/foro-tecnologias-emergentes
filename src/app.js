import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { EVENTO } from "./config.js";
import { csrfMiddleware } from "./auth.js";
import { registroRouter } from "./routes/registro.js";
import { authRouter } from "./routes/auth.js";
import { logisticaRouter } from "./routes/logistica.js";
import { certificadosRouter } from "./routes/certificados.js";
import { serviciosRouter } from "./routes/servicios.js";

// Configuración robusta de rutas para serverless (Vercel)
// Usamos process.cwd() en lugar de rutas relativas complejas
// que pueden no resolver correctamente en contenedores serverless
dotenv.config();

// Absolute path to views folder based on process.cwd()
const viewsPath = path.join(process.cwd(), "views");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.set("view engine", "ejs");
app.set("views", viewsPath);

// Cabeceras de seguridad equivalentes al front controller PHP
app.use((_req, res, next) => {
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; script-src 'self' https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self' https: wss:; worker-src 'self' blob:;",
  );
  next();
});

app.use(express.static(path.join(process.cwd(), "public")));
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "1mb" }));
app.use(csrfMiddleware);
app.use((_req, res, next) => {
  res.locals.evento = EVENTO;
  res.locals.asistenciaHabilitada = asistenciaHabilitada();
  next();
});

app.get("/", (_req, res) => res.redirect("/registro"));

app.use(registroRouter);
app.use(authRouter);
app.use(logisticaRouter);
app.use(certificadosRouter);
app.use(serviciosRouter);

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ ok: false, mensaje: "Endpoint no encontrado." });
  }
  return res.status(404).send("Página no encontrada.");
});

app.use((error, _req, res, _next) => {
  console.error("[error]", error.message);
  if (res.headersSent) return;
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ ok: false, mensaje: "El archivo excede el tamaño permitido." });
  }
  return res.status(500).send("Error interno del servidor.");
});

export default app;
