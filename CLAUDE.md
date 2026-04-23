# Convenciones del repo

## Estructura

- `apps/web`: Next.js (App Router), React Query, shadcn/ui.
- `apps/worker`: BullMQ + Playwright, integra con Supabase (service role).
- `packages/shared`: tipos y schemas compartidos.

## Estilo y calidad

- Preferir cambios pequeños y tipados.
- Validar inputs/salidas con Zod.
- Loguear con `pino` (redacta secretos).
- Errores tipados en `packages/shared/src/errors.ts`.
- Antes de merge: `yarn lint` + `yarn typecheck` + `yarn test`.

## Cola / jobs

- BullMQ con `attempts` y `backoff` exponencial.
- No loguear credenciales ni cookies (redaction activo).

