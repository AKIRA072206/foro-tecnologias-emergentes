import { Router } from "express";
import { EVENTO, STAFF } from "../config.js";
import {
  autenticarStaff,
  createSessionToken,
  readSession,
  sessionCookieOptions,
  verifyCsrf,
} from "../auth.js";

export const authRouter = Router();
const STAFF_COOKIE = STAFF.sessionCookie;

function renderLogin(res, status, { error = null, usuario = "" } = {}) {
  return res.status(status).render("auth/login", {
    title: "Acceso Logística",
    page: "login",
    error,
    usuario,
    evento: EVENTO,
  });
}

authRouter.get("/login", (req, res) => {
  if (readSession(req)) return res.redirect("/logistica");
  return renderLogin(res, 200);
});

authRouter.post("/login", async (req, res) => {
  if (!verifyCsrf(req)) {
    return renderLogin(res, 403, { error: "Token de seguridad inválido. Recargue la página." });
  }

  // Pausa anti fuerza bruta (equivalente al usleep del PHP)
  await new Promise((resolve) => setTimeout(resolve, 250));

  const usuario = String(req.body?.usuario ?? "").trim();
  const password = String(req.body?.password ?? "");
  const resultado = await autenticarStaff(usuario, password);

  if (!resultado.ok) {
    if (resultado.motivoNeon) console.warn("[login] neon-auth:", resultado.motivoNeon);
    return renderLogin(res, 200, { error: resultado.motivo, usuario });
  }

  const token = createSessionToken(resultado);
  res.cookie(STAFF_COOKIE, token, sessionCookieOptions());
  res.setHeader("X-Auth-Provider", resultado.proveedor);
  console.log(`[login] ${resultado.usuario} vía ${resultado.proveedor}`);
  return res.redirect("/logistica");
});

authRouter.get("/logout", (req, res) => {
  res.clearCookie(STAFF_COOKIE, { path: "/" });
  return res.redirect("/login");
});
