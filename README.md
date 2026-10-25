# II Foro de Tecnologías Emergentes: Inteligencia Artificial

Aplicación web para registro de participantes, control de asistencia y emisión de certificados digitales.

**Stack:** Node.js 22+ · Express 4.21 · EJS · Neon (Postgres + Auth + Object Storage + Functions + Realtime + AI Gateway)

**Fecha del evento:** 06 de noviembre de 2026 · 8:00 AM

> La versión anterior en PHP nativo se conserva en `app/`, `config/` y `public/index.php` como referencia. La aplicación activa es la de `src/` + `views/`.

## Servicios de Neon usados

| Servicio | Uso en la app | Variables |
|---|---|---|
| **Postgres** | estudiantes, outbox de envíos, certificados y mensajes | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` |
| **Auth** (Managed Better Auth) | login del personal de logística | `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL` |
| **Object Storage** | copia del PDF del certificado, bucket privado `certificados` | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION` |
| **Functions** | envío del certificado por correo (Resend) | `NEON_FUNCTION_NOTIFICACIONES_BASE_URL`, `FORO_FUNCTION_SECRET` |
| **Realtime** | panel de logística en vivo (sin polling) | `NEON_REALTIME_URL`, `NEON_REALTIME_SECRET` |
| **AI Gateway** | mensaje personalizado del certificado | `NEON_AI_GATEWAY_BASE_URL`, `NEON_AI_GATEWAY_TOKEN` |

La infraestructura está declarada como código en `neon.ts` y se aplica con `neon deploy`.

## Puesta en marcha

```bash
npm install

# Aplica los servicios declarados en neon.ts y sincroniza .env.local
neon deploy --env .env.local

# Esquema + datos iniciales (usa DATABASE_URL_UNPOOLED)
npm run db:migrate -- --seed

# Valida sintaxis, compila las vistas EJS y genera el bundle de Realtime
npm run build

npm start
```

Abre http://localhost:3000

| Quién | URL |
|---|---|
| Estudiantes | http://localhost:3000/registro |
| Logística | http://localhost:3000/login |
| Certificados | http://localhost:3000/certificados |

Credenciales de logística por defecto: usuario `logistica`, contraseña `foro2026`
(el login valida contra **Neon Auth** y cae al hash local sólo si Auth no responde).

## Variables locales propias

Además de las que inyecta Neon, `.env.local` define:

| Variable | Para qué |
|---|---|
| `FORO_USER` / `FORO_PASS` | credenciales de respaldo del personal |
| `FORO_PASS_HASH` | alternativa scrypt `sal:hash` (recomendada en producción) |
| `FORO_JWT_SECRET` | firma de la cookie de sesión y de los enlaces `/c/:token` |
| `FORO_FUNCTION_SECRET` | secreto compartido con la Neon Function |
| `FORO_FORZAR_ASISTENCIA` | `true` para probar asistencia antes del evento; vacío = automático por fecha |
| `FORO_PUBLIC_URL` | origen usado en los enlaces enviados por correo |
| `FORO_AI_MODEL` | modelo del AI Gateway (por defecto `gpt-5-mini`) |
| `FORO_BUCKET` | bucket de Object Storage (por defecto `certificados`) |
| `RESEND_API_KEY` | opcional; sin ella la Function deja el envío en `pendiente` |

## Rutas

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | redirige a `/registro` |
| GET/POST | `/registro` | formulario y alta de participantes (JSON o HTML) |
| GET/POST | `/login` · GET `/logout` | sesión del personal |
| GET | `/logistica` | panel (SSR) |
| GET | `/logistica/lista` | listado JSON (respaldo del polling) |
| GET | `/logistica/live` | sella la query de Neon Realtime |
| POST | `/logistica/asistencia` | confirma asistencia (UPDATE atómico, irreversible) |
| GET | `/certificados` · `/certificados/buscar` | consulta por cédula |
| GET | `/certificados/:id` | certificado imprimible |
| POST/GET | `/certificados/:id/pdf` | sube / firma URL del PDF en Object Storage |
| GET | `/c/:token` | enlace público firmado (90 días) |
| GET | `/api/servicios/estado` | healthcheck de los seis servicios |
| GET | `/api/ai/estado` | catálogo del AI Gateway |
| POST | `/api/ai/mensaje/:id` | regenera el mensaje del certificado con IA |

## Base de datos

- `estudiantes` — participantes; `asistio` sólo pasa de `false` a `true` una vez.
- `certificado_envios` — outbox de correos (`pendiente` / `enviado` / `error`).
- `certificados` — clave del PDF en el bucket.
- `certificado_mensajes` — mensaje del certificado (`origen`: `ai` o `fallback`).

## Scripts

```bash
npm run build        # validación + bundle de Realtime (debe pasar antes de desplegar)
npm start            # servidor en :3000
npm run dev          # recarga automática
npm run db:migrate   # esquema (+ --seed para los datos iniciales)
npm run test:e2e     # prueba integral de los seis servicios
```

## Seguridad

- Sesión JWT HS256 en cookie `HttpOnly` (8 h) y CSRF double-submit.
- Validación cliente/servidor y constraints en PostgreSQL.
- Consultas parametrizadas (`pg`), sin SQL concatenado.
- Bucket privado: el PDF se sirve con URL firmada de 1 hora.
- Cabeceras CSP, `nosniff`, `SAMEORIGIN` y `Referrer-Policy`.

## Limitaciones conocidas

- **AI Gateway:** el plan Free no sirve modelos y `neon deploy` rechaza habilitarlo. Para activarlo: subir a Launch/Scale, definir `FORO_ENABLE_AI_GATEWAY=true` y volver a desplegar. Mientras tanto, el mensaje del certificado usa el texto de respaldo (`origen = fallback`).
- **Correo:** sin `RESEND_API_KEY`, la Function responde `entregado: false` y el envío queda en `pendiente` (el flujo se prueba igual de extremo a extremo).
- **Realtime:** está en beta; el panel mantiene el polling de 15 s como respaldo si la suscripción falla.
- **Enlaces públicos:** `/c/:token` requiere `FORO_JWT_SECRET` estable entre despliegues.
