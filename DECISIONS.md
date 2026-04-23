# DECISIONS — SiRADIG Auto-Loader

Registro de decisiones técnicas no obvias. Cada entrada responde al "por qué".

---

## Autenticación en ARCA

**Decisión:** Playwright solo para login; HTTP directo (axios) para guardar deducciones.

**Por qué:** Los formularios de SiRADIG son JSPs con Struts — no hay CSRF, no hay SPA. Una vez obtenido el `JSESSIONID`, cualquier POST con cookie funciona. Playwright para cada deducción sería 5-10x más lento y mucho más frágil ante cambios de DOM.

---

## Sesión ARCA: in-memory cache + DB como respaldo

**Decisión:** `session.ts` mantiene un `Map<userId, CachedSession>` en memoria. Antes de hacer login, verifica: (1) cache en RAM, (2) `last_session_cookie` en DB + ping keepalive. Solo hace login nuevo si ambos fallan.

**Por qué:** Evita N logins para N facturas del mismo usuario. ARCA puede banear IP por demasiados logins seguidos. La cookie se guarda encriptada en DB para sobrevivir reinicios del worker.

---

## Encriptación de la clave fiscal: AES-256-GCM con salt por usuario

**Decisión:** La clave fiscal se encripta con `CREDENTIALS_MASTER_KEY` + `userId` como salt via HKDF. IV y auth tag se guardan separados en la tabla.

**Por qué:** Si se filtra la DB, un atacante necesita también la master key del entorno. El salt por usuario previene que dos usuarios con la misma clave generen el mismo ciphertext.

**Invariante crítico:** La clave fiscal nunca toca localStorage, logs, ni viaja en query strings.

---

## Categorías ARCA: 1 confirmada, resto experimental

**Decisión:** `ARCA_ENDPOINTS` en `packages/shared/src/types/arca.ts` tiene un flag `experimental: true` en las 9 categorías no verificadas.

**Por qué:** Solo `Indumentaria/Equipamiento` fue inspeccionada en vivo (DOM real). Las demás rutas son inferencias por convención Struts. Se necesita correr `scripts/inspect-arca-form.ts` con credenciales reales para confirmar payload antes de activarlas.

---

## Error handling: clases tipadas + `retryable` flag

**Decisión:** Todas las clases en `packages/shared/src/errors.ts` heredan de `AppError` que tiene `retryable: boolean`. BullMQ llama `job.discard()` si el error no es retryable (ej: `ValidationError`).

**Por qué:** Evita reintentar errores de datos corruptos (datos de la factura incorrectos). Solo reintenta errores transitorios (sesión expirada, rate limit, timeout de red).

---

## Rate limiting: BullMQ limiter + constante `ARCA_RATE_LIMIT_MS`

**Decisión:** Worker configurado con `limiter: { max: 1, duration: ARCA_RATE_LIMIT_MS }` (default 800ms). Si ARCA devuelve 429/503, se pausa el worker.

**Por qué:** ARCA es un sistema legacy del 2011 corriendo en Java. No tiene documentación de rate limits. 800ms es conservador pero evita bloqueos.

---

## Monorepo: Turborepo + Yarn Workspaces (no nx)

**Decisión:** Turborepo para caché de builds; Yarn Berry (3.x) para workspaces.

**Por qué:** Stack familiar para el equipo, buen soporte de Next.js out-of-the-box, y `turbo dev` levanta web + worker en paralelo con un solo comando.

---

## Storage: Supabase Storage (no S3 directo)

**Decisión:** Facturas se suben al bucket `facturas` en Supabase Storage, privado, con política RLS por `user_id`.

**Por qué:** RLS en Supabase Storage se maneja igual que en tablas, sin infraestructura adicional. El bucket es privado — las URLs firmadas se generan server-side.

---

## Column naming en `facturas`: `extraction_*` para datos de Claude, `edited_*` para datos del usuario

**Decisión:** Los campos retornados por Claude Vision usan prefijo `extracted_` (ej: `extracted_cuit`) excepto confianza y respuesta raw que usan `extraction_confidence` y `extraction_raw_response`.

**Por qué:** Inconsistencia heredada de TRAE. El código está en sync con la migration — no se cambia para evitar una migration adicional.
