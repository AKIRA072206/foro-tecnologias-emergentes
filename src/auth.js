import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { IS_PROD, NEON, STAFF } from "./config.js";

const SCRYPT_KEYLEN = 64;

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Verifica la contraseña local (scrypt si hay hash, texto plano en dev). */
export function verifyLocalPassword(password) {
  if (STAFF.passwordHash) {
    const [salt, expected] = STAFF.passwordHash.split(":");
    if (!salt || !expected) return false;
    const actual = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
    return timingSafeEqual(actual, expected);
  }
  return timingSafeEqual(password, STAFF.password);
}

/**
 * Login contra Neon Auth (Managed Better Auth).
 * Devuelve { ok, user } o { ok:false, motivo }.
 */
export async function signInWithNeonAuth(email, password) {
  if (!NEON.authBaseUrl) return { ok: false, motivo: "NEON_AUTH_BASE_URL no configurada" };

  try {
    const response = await fetch(`${NEON.authBaseUrl}/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: process.env.FORO_ORIGIN ?? "http://localhost:3000",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const detalle = await response.text().catch(() => "");
      return { ok: false, motivo: `Neon Auth ${response.status}: ${detalle.slice(0, 200)}` };
    }

    const data = await response.json();
    if (!data?.user?.email) return { ok: false, motivo: "Neon Auth sin usuario en la respuesta" };
    return { ok: true, user: data.user };
  } catch (error) {
    return { ok: false, motivo: `Neon Auth inaccesible: ${error.message}` };
  }
}

/**
 * Autentica al personal: primero Neon Auth (por email), con respaldo local
 * para las credenciales históricas. registra qué proveedor resolvió.
 */
export async function autenticarStaff(usuario, password) {
  if (!usuario || !password) return { ok: false, motivo: "Credenciales vacías" };

  const email = usuario.includes("@") ? usuario : STAFF.email;
  const neon = await signInWithNeonAuth(email, password);

  if (neon.ok) {
    return {
      ok: true,
      proveedor: "neon-auth",
      usuario: neon.user.email,
      sub: neon.user.id,
    };
  }

  if (usuario === STAFF.usuario && verifyLocalPassword(password)) {
    return {
      ok: true,
      proveedor: "local",
      usuario: STAFF.usuario,
      sub: `local:${STAFF.usuario}`,
      motivoNeon: neon.motivo,
    };
  }

  return { ok: false, motivo: "Usuario o contraseña incorrectos.", motivoNeon: neon.motivo };
}

export function createSessionToken({ sub, usuario, proveedor }) {
  return jwt.sign({ sub, usuario, idp: proveedor }, STAFF.jwtSecret, {
    algorithm: "HS256",
    expiresIn: STAFF.ttlSeconds,
    issuer: "foro-uptyab",
  });
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,
    maxAge: STAFF.ttlSeconds * 1000,
    path: "/",
  };
}

export function readSession(req) {
  const token = req.cookies?.[STAFF.sessionCookie];
  if (!token) return null;
  try {
    return jwt.verify(token, STAFF.jwtSecret, { issuer: "foro-uptyab" });
  } catch {
    return null;
  }
}

/** Token firmado para el enlace público /c/:token */
export function createCertificateToken(estudianteId) {
  return jwt.sign({ sid: estudianteId, scope: "certificado" }, STAFF.certSecret, {
    algorithm: "HS256",
    expiresIn: "90d",
    issuer: "foro-uptyab",
  });
}

export function readCertificateToken(token) {
  try {
    const payload = jwt.verify(token, STAFF.certSecret, { issuer: "foro-uptyab" });
    if (payload.scope !== "certificado" || !payload.sid) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireStaff(req, res, next) {
  const session = readSession(req);
  if (!session) {
    if (isAjax(req)) {
      return res.status(401).json({ ok: false, mensaje: "Sesión expirada. Inicie sesión nuevamente." });
    }
    return res.redirect("/login");
  }
  req.session = session;
  res.locals.usuario = session.usuario;
  next();
}

export function isAjax(req) {
  const requestedWith = req.get("x-requested-with") ?? "";
  const accept = req.get("accept") ?? "";
  return requestedWith.toLowerCase() === "xmlhttprequest" || accept.includes("application/json");
}

/** CSRF double-submit: cookie legible + campo oculto/header. */
export function csrfMiddleware(req, res, next) {
  let token = req.cookies?.[STAFF.csrfCookie];
  if (!token || token.length !== 64) {
    token = crypto.randomBytes(32).toString("hex");
    res.cookie(STAFF.csrfCookie, token, {
      httpOnly: false,
      sameSite: "lax",
      secure: IS_PROD,
      maxAge: STAFF.ttlSeconds * 1000,
      path: "/",
    });
  }
  res.locals.csrf = token;
  next();
}

export function verifyCsrf(req) {
  const sent = req.body?._csrf ?? req.get("x-csrf-token") ?? "";
  const cookie = req.cookies?.[STAFF.csrfCookie] ?? "";
  return Boolean(sent) && timingSafeEqual(sent, cookie);
}
