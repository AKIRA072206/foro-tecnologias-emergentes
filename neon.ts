import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Login del personal de logística (Managed Better Auth)
  auth: true,

  // Un solo credencial para los modelos del catálogo.
  // BLOQUEADO: el plan Free no sirve modelos y `neon deploy` se niega a
  // habilitarlo. Al pasar a Launch/Scale basta con definir
  // FORO_ENABLE_AI_GATEWAY=true y volver a desplegar.
  ...(process.env.FORO_ENABLE_AI_GATEWAY === "true" ? { aiGateway: true } : {}),

  // Panel de logística en vivo (reemplaza el polling de 15 s)
  preview: {
    realtime: true,
  },

  // Envío de certificados por correo (Resend si hay key; si no, outbox)
  functions: {
    notificaciones: {
      name: "Notificaciones de certificados",
      source: "./functions/notificaciones.js",
      env: {
        FORO_FUNCTION_SECRET: process.env.FORO_FUNCTION_SECRET!,
      },
    },
  },

  // PDFs de certificados generados en el navegador
  buckets: {
    certificados: { access: "private" },
  },

  // Ramas nuevas que no son la default expiran solas
  branch: (branch) => {
    if (branch.isDefault) return {};
    if (!branch.exists) return { ttl: "7d" };
    return {};
  },
});
