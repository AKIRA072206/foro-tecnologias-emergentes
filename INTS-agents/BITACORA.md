# Bitácora — II Foro de Tecnologías Emergentes

Última actualización: 2026-10-29
Rama de trabajo: `test`
HEAD: `9267752`

## 1. Objetivo

Portar el delta funcional de la versión PHP 2.0 a la app activa
Node/Express + EJS sobre Neon, sin reemplazar la arquitectura.

## 2. Decisiones

- Certificado: mantener `html2pdf` + `plantilla-certificado.png`.
- Eliminar: modal de confirmación; bloquear si `asistio = true`.
- `FORO_FORZAR_ASISTENCIA=true` solo para pruebas; desactivar antes del 06/11/2026.
- Resend opcional: sin API key el envío queda `pendiente`.
- E2E aislado en branch Neon `test`.

## 3. Ramas y despliegue

- Git `test`: `9267752` (sincronizada con `origin/test`).
- Git `main`: `0badba5` (sin cambios).
- Vercel proyecto: `prj_t8HCeZVgzhy8kgXSc3diq5LHErQC`.
- Alias producción: `https://foro-tecnologias-emergentes.vercel.app`.
- Neon proyecto: `weathered-tooth-20505817`.
- Neon production: `br-jolly-silence-b4uutppa`.
- Neon test: `br-dawn-bonus-b44nl62w`.

## 4. Fases completadas

### Fase 0 — Vercel

- `vercel.json`: `"includeFiles": "{views/**,public/**}"`.
- Deploy actual `READY`; alias responde 200.

### Fase 1 — Base de datos

- Nuevo `database/migrate_institucion.sql` idempotente:
  - `institution_name VARCHAR(150) NOT NULL DEFAULT 'No indicó institución'`
  - `institution_type VARCHAR(20) NOT NULL DEFAULT 'no_indico'`
  - índice `idx_estudiantes_institution_type`
  - check `chk_estudiantes_institution_type`
- `database/neon_schema.sql` actualizado.
- `scripts/migrate.mjs` ejecuta la migración incremental.
- Aplicada 2 veces en branch test sin errores.
- **Pendiente:** aplicar en branch producción antes del deploy.

### Fase 2 — Backend

- `src/validator.js`: `validarInstitucion()`.
- `src/models/estudiantes.js`: campos institución + `eliminar()`.
- `src/routes/registro.js`: acepta y conserva los 3 campos.
- `src/routes/logistica.js`:
  - `/logistica/lista` expone institución.
  - `POST /logistica/eliminar`: 401 / 403 / 422 / 404 / 409 / 200.
- `src/services/realtime.js`: query sellada con institución.
- `src/client/logistica-live.js`: normalizador actualizado.
- `src/server.js`: corregido import faltante de `EVENTO`.

### Fase 3 — Frontend

- Registro: selector procedencia, campos condicionales, modal de éxito.
- Logística: columna Institución, filtros por tipo, columna Acciones,
  modal de confirmación.
- `public/css/style.css`: estilos de filtros y modales.
- Bundle `public/js/logistica-live.js` regenerado.

### Fase 4 — Pruebas

- `npm run build`: OK (22 JS, 7 EJS, bundle, activos).
- `npm run db:migrate`: idempotente en test.
- Smoke HTTP local: `/registro`, CSS, JS, `/logistica` 302 → `/login`.
- E2E: **32/34 PASS**.
  - Verdes: institución, `no_indico`, delete 401/403/404/200,
    cascada outbox, bloqueo delete con asistencia.
  - Fallos ambientales:
    1. Neon Realtime: URL/secret de producción vs query de test.
    2. AI Gateway: variables ausentes (plan Free).

### Prueba local visual (2026-10-29)

Servidor `http://localhost:3100` contra branch Neon `test`.

- Registro con institución → modal de éxito visible.
- Login Neon Auth → panel de logística.
- Filtros: Universidad = 1 fila, Empresa = 0, Todos = 1.
- Modal de eliminar: abrir, cancelar y confirmar.
- Eliminar confirmado: fila borrada y contadores actualizados.
- Asistencia confirmada: selector bloqueado y botón Eliminar `disabled`.
- Responsive 1280 / 768 / 360 px: sin scroll horizontal de página
  (`scrollWidth == innerWidth`); la tabla ancha hace scroll dentro de
  `.table-responsive`.
- Consola: solo warnings de Realtime por usar branch test.
- Evidencia: `INTS-agents/pruebas/*.png`.
- Nota: el outbox quedó en `error` por timeout de la Neon Function
  (`The operation was aborted due to timeout`); el mensaje AI usó fallback.

## 5. Riesgos conocidos

- Migración producción debe correr **antes** del deploy.
- Preview de Vercel sigue usando DB producción si no se configura env Preview.
- `foro_backup.sql` contiene PII; nunca publicar.
- URLs `*-hash.vercel.app` están protegidas por SSO.

## 6. Pendientes

- [x] Pruebas visuales 360 / 768 / 1280 px (ver evidencia en `pruebas/`).
- [ ] Migrar producción.
- [ ] Merge `test` → `main` y push.
- [ ] Verificar deploy Vercel y smoke producción.
- [ ] Configurar `RESEND_API_KEY` / `RESEND_FROM`.
- [ ] Quitar `FORO_FORZAR_ASISTENCIA` antes del evento.

## 7. Comandos locales

```powershell
git switch test
npm install
npm run db:migrate
npm run build
npm start
```
