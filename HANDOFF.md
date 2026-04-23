# HANDOFF — Proyecto SiRADIG Auto-Loader

> Este documento contiene todo el contexto necesario para continuar este proyecto en Claude Code. Leelo completo antes de empezar a trabajar.

---

## 1. Quién soy y qué estoy construyendo

Soy **Seba Loguzzo**, Senior Frontend Engineer & Tech Lead argentino, 8+ años de React. Stack preferido: Next.js + TypeScript + React. Uso **Yarn** (no npm), **Jotai** (no Redux), **Atomic Design**, **archivos ≤ 80 líneas**, **Conventional Commits**.

Estoy construyendo **SiRADIG Auto-Loader**: una app SaaS que automatiza la carga de deducciones en el formulario **F572 Web de ARCA (ex AFIP) / SiRADIG** a partir de fotos o PDFs de facturas, para empleados argentinos en relación de dependencia.

**Flujo del usuario:** sube factura → Claude Vision extrae datos → usuario valida en tabla editable → backend se loguea a ARCA con Playwright + carga deducciones con POSTs HTTP directos → usuario ve resultado en tiempo real.

Esto puede terminar siendo producto dentro de mi agencia **Custom-XS** (custom-xs.com) o herramienta interna.

---

## 2. Investigación técnica ya realizada (NO REINVESTIGAR)

En una conversación previa en Claude.ai, usando Claude for Chrome, hicimos **reverse engineering en vivo del SiRADIG de ARCA**. Lo siguiente está **confirmado por inspección del DOM real** (no asumido):

### Autenticación ARCA

- Login URL: `https://auth.afip.gob.ar/contribuyente_/login.xhtml`
- Selectores usados (⚠️ validar antes de codear, ARCA cambia login ocasionalmente):
  - `#F1\:username` → ingresar CUIT
  - `#F1\:btnSiguiente` → submit paso 1
  - `#F1\:password` → ingresar clave fiscal
  - `#F1\:btnIngresar` → submit paso 2
  - `#F1\:captcha` → si aparece, hay captcha (fallar gracefully)
- Tras login exitoso, redirige a `portalcf.cloud.afip.gob.ar`
- Para acceder a SiRADIG navegar a: `https://serviciosjava2.afip.gob.ar/radig/jsp/verMenuEmpleado.do` (dispara SSO)
- **Sesión se mantiene con cookie `JSESSIONID`** del dominio `serviciosjava2.afip.gob.ar`
- **NO hay JWT, ni OAuth, ni CSRF tokens** (confirmado inspeccionando `#formulario` en vivo)
- Keepalive: `GET /radig/jsp/ajax.do?f=keepalive&_=<timestamp>` mantiene la sesión activa
- Sesión expira por inactividad ~20-30min

### Endpoints SiRADIG mapeados

**Navegación principal (todos GET):**
- `/radig/jsp/verMenuEmpleado.do` — home post-login
- `/radig/jsp/verMenuDeducciones.do` — F572 Web, índice
- `/radig/jsp/verDatosPersonales.do`
- `/radig/jsp/verMenuEmpleadores.do`
- `/radig/jsp/verFormulariosEnviados.do`
- `/radig/jsp/verF1357.do`

**Categoría CONFIRMADA 100%: Indumentaria/Equipamiento**
- GET `/radig/jsp/verGastosInduEquip.do` — ver listado
- **POST `/radig/jsp/guardarGastosInduEquip.do`** — guardar nueva deducción
- GET `/radig/jsp/eliminarDeduccion.do?id={id}` — eliminar

**Payload del POST (confirmado, form-urlencoded):**
```
numeroDoc=20XXXXXXXXX              # CUIT proveedor (11 dígitos)
razonSocial=EMPRESA SA             # autocompletado por ARCA tras CUIT válido
idConcepto=1                       # 1=Indumentaria, 2=Equipamiento
mesDesde=4                         # 1-12
montoTotal=10000.00                # decimal con punto
numeroDocTmp=20XXXXXXXXX           # buffer interno, copia de numeroDoc
comprobanteIdFilaAgregada=1        # index de fila (empieza en 1)
comprobanteFechaEmision=15/04/2026 # formato DD/MM/YYYY
comprobanteTipo=1                  # 1=Factura A, 6=Factura B, etc.
comprobantePuntoVenta=0001         # 4 dígitos con ceros a la izq
comprobanteNumero=00012345         # 8 dígitos con ceros a la izq
comprobanteNumeroAlternativo=
comprobanteMontoFacturado=10000.00
comprobantesEliminados=
codigo=                            # hidden sin valor
```

**Categorías NO CONFIRMADAS (inferidas por convención Struts):**
Están declaradas en `packages/shared/src/types/arca.ts` con `experimental: true`. **Hay que mapear cada una en vivo** con un script `scripts/inspect-arca-form.ts` (pendiente de crear). Las rutas inferidas son `verGastosEducacion.do`, `verAlquileres.do`, `verMedicinaPrepaga.do`, etc. pero NO están confirmadas.

### Info del sistema SiRADIG (contexto)
- Java legacy (JSPs + Struts `.do` actions)
- jQuery 1.6 (de 2011), muy vieja
- Keepalive JS embebido: `ajax.do?f=keepalive`
- Formularios usan `validationEngine` client-side pero la validación real es server-side
- Respuesta de guardado es HTML (redirect a listado con fila agregada, o error inline con `.errorMessage`/`.error`)

---

## 3. Estado actual del proyecto

TRAE generó una primera versión del monorepo. **Está al 40-50% del MVP.** Estructura:

```
siradig/
├── apps/
│   ├── web/          # Next.js 14 App Router
│   └── worker/       # Node worker con BullMQ + Playwright
├── packages/
│   └── shared/       # zod schemas + tipos ARCA
├── turbo.json
├── package.json (workspace root)
└── PROMPT_TRAE.md    # prompt original completo
```

### Lo que YA funciona (o debería)

- Monorepo con Turborepo + Yarn workspaces configurado
- Stack correcto: Next 14, TypeScript, Supabase, BullMQ, Playwright, Anthropic SDK, Tailwind, shadcn base, Jotai, TanStack Query, react-hook-form, zod, sharp, cheerio, axios-cookiejar-support
- Middleware de auth con Supabase SSR
- API routes: upload, extract, credentials, test-credentials, enqueue, jobs
- `extractFactura.ts` con Claude Vision (modelo `claude-sonnet-4-5`) + retry + parseo robusto de JSON
- Crypto AES-256-GCM para credenciales (en `apps/web/src/lib/crypto/` y `apps/worker/src/lib/crypto/`)
- Adapter de **Indumentaria/Equipamiento** implementado y siguiendo el payload confirmado
- Procesador BullMQ `cargarDeduccion.ts` (167 líneas, un poco largo pero OK)
- `parseArcaResponse` con cheerio para detectar éxito/error del HTML de ARCA
- Componentes organism: `LoginForm`, `SignupForm`, `ArcaCredentialsForm`, `FacturaDropzone`, `FacturasList`
- Páginas: login, signup, dashboard, facturas, facturas/upload, jobs, configuracion/credenciales-arca
- Schemas zod compartidos en `packages/shared`
- Tabla `ARCA_ENDPOINTS` con las 10 categorías (1 confirmada, 9 experimental)

### Lo que FALTA (gaps identificados en análisis previo)

**Infraestructura (bloqueante para levantar):**
1. `supabase/migrations/0001_init.sql` — el schema SQL completo no se materializó. Sin esto no arranca.
2. `.env.example` en raíz, `apps/web/` y `apps/worker/`
3. `docker-compose.yml` con Redis + Postgres local
4. `.gitignore` raíz completo (actual tiene 20 bytes)
5. Husky + lint-staged + commitlint con Conventional Commits
6. README completo (actual tiene 10 bytes, literal vacío)
7. `CLAUDE.md` con convenciones del proyecto
8. `DECISIONS.md` para documentar tradeoffs

**Robustez del worker:**
1. **Keepalive NO implementado** — cada job hace login nuevo (lento + peligroso: 50 facturas = 50 logins = ban de ARCA)
2. **No reusa sesión** — el campo `last_session_cookie` del schema existe pero no se lee
3. **No hay retry policies** — BullMQ soporta `attempts` + `backoff`, no se usa
4. **No hay logger** — pediste pino estructurado con redacción de secrets, todo es `console.log` implícito
5. **No hay custom error classes** — todo es `new Error(string)`. Pediste `ArcaLoginError`, `ArcaRateLimitError`, `ArcaSessionExpiredError`, `ExtractionError`, `ValidationError`

**Completitud:**
1. **9 de 10 adapters faltan** — solo Indumentaria está implementada. Las otras están como endpoints experimental en el type
2. **Scripts helpers no existen** — `scripts/inspect-arca-form.ts` (spike de mapeo), `scripts/rotate-master-key.ts`, `scripts/seed.ts`
3. **Tests: cero** — ni Jest/RTL, ni Playwright Test E2E
4. **Componentes shadcn faltantes** — solo hay Button e Input. Faltan Card, Table, Dialog, Checkbox, Select, Tabs, Badge, etc.
5. **Tabla editable inline** en `/facturas` con TanStack Table — no implementada
6. **Supabase Realtime** en `/jobs` — página existe pero sin realtime real
7. **Dashboard** con Recharts (stats + gráfico por categoría) — básico
8. **Rate limiting adaptativo** — no implementado
9. **Audit log** — tabla en schema pero no se escribe desde ningún lado

---

## 4. Plan de trabajo acordado

La continuación está dividida en **3 prompts secuenciales** (no uno grande, funciona mejor iterativo):

### FASE 1 — "Infraestructura y arranque local" (EMPEZAR ACÁ)

Objetivo: dejar el proyecto levantable con `yarn dev`.

1. Generar `supabase/migrations/0001_init.sql` con el schema completo (ver sección 5)
2. Crear `.env.example` en raíz, `apps/web/` y `apps/worker/`
3. Crear `docker-compose.yml` con Redis + Postgres local (postgres 16, redis 7)
4. Setup Husky + lint-staged + commitlint (Conventional Commits: feat/fix/chore/docs/refactor/test)
5. `.gitignore` robusto (node_modules, .next, dist, .turbo, .env*, coverage, playwright-report, *.log)
6. README completo con setup paso a paso (clone → yarn → docker-compose up → migrations → yarn dev)
7. `CLAUDE.md` con convenciones del proyecto (para futuro uso con Claude Code)
8. `DECISIONS.md` inicial con decisiones ya tomadas

### FASE 2 — "Robustez del worker"

1. **Reuso de sesión ARCA** — consultar `last_session_cookie` + `last_session_expires_at` antes de re-login; validar con un ping a `ajax.do?f=keepalive` antes de asumir viva
2. **Keepalive** — si hay jobs en cola, cron interno cada 5 min que hace ping por usuario activo
3. **Custom error classes** — todas en `apps/worker/src/arca/errors.ts`:
   - `ArcaLoginError` (credenciales inválidas)
   - `ArcaCaptchaError` (captcha presente)
   - `ArcaSessionExpiredError` (cookie inválida)
   - `ArcaRateLimitError` (503/429)
   - `ArcaValidationError` (error de validación server-side con mensaje parseado)
   - `ExtractionError` (Claude Vision falló)
4. **Retry policies** — `attempts: 3`, backoff exponencial para errores transitorios; retry 0 para validation errors
5. **Logger estructurado con pino** — web y worker, con redacción de `claveFiscal`, `CREDENTIALS_MASTER_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
6. **Script `scripts/inspect-arca-form.ts`** — Playwright + credenciales locales, recibe un path (ej: `verGastosEducacion.do`), loguea, navega, extrae schema del `#formulario` (action, method, inputs, selects con opciones, hiddens). Output: JSON en stdout + archivo `inspected/<categoria>.json`
7. **Diccionario de errores de ARCA** en `apps/worker/src/arca/errorMessages.ts` — mapeo de strings de error conocidos a mensajes amigables en español
8. **Tests unitarios** con Jest:
   - `apps/web/src/lib/crypto/credentials.test.ts` — roundtrip encrypt/decrypt, fail con salt incorrecto
   - `apps/worker/src/arca/parseResponse.test.ts` — fixtures de HTML éxito + error
   - `apps/worker/src/arca/adapters/indumentaria.test.ts` — mock de axios, verifica body URL-encoded correcto
   - Coverage objetivo: >70% en `lib/` y `adapters/`

### FASE 3 — "UI completa y adapters faltantes"

1. Componentes shadcn completos: Card, Table, Dialog, Checkbox, Select, Tabs, Badge, Toast (ya hay sonner), Skeleton, Dropdown
2. `/facturas` con tabla editable inline usando **TanStack Table v8** — cada celda es click-to-edit; cambios se persisten con debounce a `PATCH /api/facturas/[id]`
3. `/jobs` con **Supabase Realtime real** — suscripción a `load_jobs` filtrada por `user_id`; UI actualiza sin polling
4. `/dashboard` con Recharts: BarChart por categoría, stats cards, timeline de últimas cargas
5. Ejecutar el script `inspect-arca-form.ts` **en vivo con mis credenciales** para mapear: Educación, Alquiler, Medicina Prepaga, Donaciones
6. Implementar esos 4 adapters adicionales siguiendo el patrón de Indumentaria
7. E2E con Playwright Test: flujo signup → upload → extract (mockeado) → edit → load (mockeando ARCA con MSW o nock)

---

## 5. Schema SQL objetivo (para Fase 1)

```sql
-- supabase/migrations/0001_init.sql

-- ARCA credentials (1 por usuario)
create table public.arca_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cuit text not null check (cuit ~ '^[0-9]{11}$'),
  clave_fiscal_encrypted text not null,
  clave_fiscal_iv text not null,
  clave_fiscal_tag text not null,
  last_used_at timestamptz,
  last_session_cookie text,
  last_session_expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Facturas (subidas + extraídas + editadas)
create table public.facturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_bucket text not null default 'facturas',
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes integer,

  extracted_cuit text,
  extracted_razon_social text,
  extracted_tipo_comprobante text,
  extracted_punto_venta text,
  extracted_numero text,
  extracted_fecha_emision date,
  extracted_monto_total numeric(15, 2),
  extracted_categoria_sugerida text,
  extracted_confianza numeric(3, 2),
  extracted_observaciones text,
  extracted_raw jsonb,

  edited_cuit text,
  edited_razon_social text,
  edited_tipo_comprobante text,
  edited_punto_venta text,
  edited_numero text,
  edited_fecha_emision date,
  edited_monto_total numeric(15, 2),
  edited_categoria text,
  edited_mes_deduccion integer check (edited_mes_deduccion between 1 and 12),
  edited_id_concepto integer,

  status text not null default 'uploaded' check (status in (
    'uploaded','extracting','extracted','ready','queued','loading','loaded','failed'
  )),
  error_message text,
  arca_deduccion_id text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_facturas_user_id on public.facturas(user_id);
create index idx_facturas_status on public.facturas(status);

-- Jobs de carga
create table public.load_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  factura_id uuid not null references public.facturas(id) on delete cascade,
  bullmq_job_id text,
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Audit log
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

-- RLS
alter table public.arca_credentials enable row level security;
alter table public.facturas enable row level security;
alter table public.load_jobs enable row level security;
alter table public.audit_log enable row level security;

create policy "users_own_credentials" on public.arca_credentials
  for all using (auth.uid() = user_id);
create policy "users_own_facturas" on public.facturas
  for all using (auth.uid() = user_id);
create policy "users_own_jobs" on public.load_jobs
  for all using (auth.uid() = user_id);
create policy "users_own_audit" on public.audit_log
  for select using (auth.uid() = user_id);

-- Storage bucket privado
insert into storage.buckets (id, name, public) values ('facturas', 'facturas', false)
on conflict (id) do nothing;

create policy "users_own_facturas_storage" on storage.objects
  for all using (
    bucket_id = 'facturas' and
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

---

## 6. Variables de entorno

```bash
# .env.local.local (raíz del monorepo, o en cada app)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_URL=                  # para worker

# Anthropic
ANTHROPIC_API_KEY=

# Redis (local: redis://localhost:6379, prod: Upstash)
REDIS_URL=redis://localhost:6379

# Crypto (64 hex chars = 32 bytes)
# Generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CREDENTIALS_MASTER_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Worker tuning
WORKER_CONCURRENCY=2
ARCA_RATE_LIMIT_MS=800
```

---

## 7. Reglas que NO se negocian

- **Yarn, no npm**
- **Jotai, no Redux/Zustand**
- **App Router, no Pages Router**
- **Tailwind, no CSS Modules / styled-components**
- **Archivos ≤ 80 líneas** (refactor si se pasa, salvo justificación puntual)
- **TypeScript estricto, no `any`** (usar `unknown` + type guards)
- **Conventional Commits**
- **Atomic Design** (atoms/molecules/organisms/templates)
- **Clave fiscal NUNCA en localStorage/sessionStorage del browser**
- **Clave fiscal NUNCA en logs**
- **HTTP directo para guardar deducciones** (no Playwright, solo para login)
- **Rate limit a ARCA: max 1 req / 800ms**
- **Código en inglés, comentarios y UI strings en español Rioplatense**
- **Concise communication** — no me expliques de más, sé directo. Si no sabés algo, decilo. Aplicá pensamiento crítico, no aceptes todo automáticamente.

---

## 8. Pendientes críticos para validar antes de codear

1. **Selectores de login AFIP** (`#F1\:username`, etc.) — AFIP cambia el login cada tanto. Antes de ejecutar cualquier test real con Playwright, validar estos selectores en vivo.
2. **Rutas de categorías no confirmadas** — las 9 categorías `experimental: true` en `ARCA_ENDPOINTS` son inferencias. Hay que mapearlas con el script `inspect-arca-form.ts` (Fase 2).
3. **Valores de `idConcepto` por categoría** — solo están confirmados los de Indumentaria/Equipamiento (1 y 2). Los demás hay que relevarlos del `<select>` en vivo.

---

## 9. Arrancar ahora

**Paso inmediato:** ejecutar Fase 1 (Infraestructura y arranque local). Objetivo: que `yarn install && docker-compose up && yarn dev` levante todo sin errores.

Antes de escribir código, confirmá que entendés:
- Qué falta (sección 3 "Lo que FALTA")
- Qué hay que hacer en Fase 1 (sección 4)
- Las reglas no negociables (sección 7)

Cuando tengas dudas de diseño no cubiertas acá, elegí la opción más **simple**, **segura** y **mantenible**, y agregala a `DECISIONS.md`.
