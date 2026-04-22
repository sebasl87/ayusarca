# Prompt para TRAE — Proyecto "SiRADIG Auto-Loader"

> Copiá todo lo que está debajo de esta línea y pegalo en TRAE como prompt inicial del proyecto.

---

# Contexto y Objetivo del Proyecto

Actuá como **Staff Engineer Full-Stack especializado en TypeScript, Next.js 14, automatización headless y web scraping seguro**. Vas a construir un producto completo desde cero llamado **SiRADIG Auto-Loader** (nombre interno, después se rebrandea).

## ¿Qué es y para qué sirve?

Es una aplicación web SaaS que permite a empleados argentinos en relación de dependencia **cargar automáticamente sus deducciones y desgravaciones en el formulario F572 Web de ARCA (ex AFIP) — SiRADIG**, a partir de fotos o PDFs de facturas.

### Flujo del usuario final

1. El usuario se registra en la app con email/password
2. Configura sus **credenciales de ARCA** (CUIT + clave fiscal) — se almacenan **encriptadas** con AES-256-GCM
3. Sube **una o varias facturas** (imagen o PDF) por drag & drop
4. La app usa **Claude Vision (modelo `claude-sonnet-4-5`)** para extraer:
   - CUIT del emisor
   - Razón social
   - Tipo de comprobante (A, B, C, etc.)
   - Punto de venta
   - Número de comprobante
   - Fecha de emisión
   - Monto total
   - Categoría sugerida (indumentaria, educación, alquiler, medicina prepaga, etc.)
5. El usuario **revisa y edita** los datos extraídos en una tabla editable
6. El usuario hace clic en "Cargar a SiRADIG"
7. El backend:
   - Hace login a ARCA con Playwright (una vez por sesión, guarda la cookie `JSESSIONID`)
   - Para cada factura, hace un **POST HTTP directo** al endpoint correspondiente (sin Playwright — mucho más rápido)
   - Actualiza el estado en tiempo real en el frontend
8. El usuario ve el resultado: cuántas se cargaron OK, cuáles fallaron y por qué

---

# Investigación técnica ya realizada (NO REINVESTIGAR)

Ya se hizo reverse engineering del sistema SiRADIG de ARCA. El sistema vive en `https://serviciosjava2.afip.gob.ar/radig/` y es un Java legacy (JSPs + `.do` actions). A continuación, los hallazgos clave **confirmados en producción**:

## Autenticación

- Login se hace en: `https://auth.afip.gob.ar/contribuyente_/login.xhtml`
- Tras login, la sesión se mantiene con la **cookie `JSESSIONID`** del dominio `serviciosjava2.afip.gob.ar`
- **No hay JWT, ni OAuth, ni CSRF tokens en los formularios** (confirmado inspeccionando `#formulario` en vivo)
- Keepalive: `GET /radig/jsp/ajax.do?f=keepalive&_=<timestamp>` mantiene la sesión activa
- La sesión expira por inactividad (~20-30 min). Hay que hacer keepalive cada 5 min mientras haya jobs en cola

## Endpoints mapeados

### Navegación principal

| Path | Descripción |
|------|-------------|
| `/radig/jsp/verMenuEmpleado.do` | Home post-login |
| `/radig/jsp/verMenuDeducciones.do` | F572 Web — índice de secciones |
| `/radig/jsp/verDatosPersonales.do` | Datos personales |
| `/radig/jsp/verMenuEmpleadores.do` | Empleadores |
| `/radig/jsp/verFormulariosEnviados.do` | Consulta formularios enviados |
| `/radig/jsp/verF1357.do` | Consulta F1357 |

### Formulario confirmado: Gastos de Indumentaria/Equipamiento

- **URL del formulario**: `GET /radig/jsp/verGastosInduEquip.do`
- **Endpoint de guardado**: `POST /radig/jsp/guardarGastosInduEquip.do`
- **Content-Type**: `application/x-www-form-urlencoded`
- **Eliminar**: `GET /radig/jsp/eliminarDeduccion.do?id={deduccionId}`

**Campos del POST (form-urlencoded):**

```
numeroDoc=20XXXXXXXXX              # CUIT del proveedor (11 dígitos)
razonSocial=NOMBRE SA              # autocompletado por ARCA al validar CUIT
idConcepto=1                       # 1=Indumentaria, 2=Equipamiento
mesDesde=4                         # mes del 1 al 12
montoTotal=10000.00                # importe decimal con punto
numeroDocTmp=20XXXXXXXXX           # buffer interno - copia de numeroDoc
comprobanteIdFilaAgregada=1        # index de fila (empieza en 1)
comprobanteFechaEmision=15/04/2026 # formato DD/MM/YYYY
comprobanteTipo=1                  # 1=Factura A, 6=Factura B, etc.
comprobantePuntoVenta=01
comprobanteNumero=12345
comprobanteNumeroAlternativo=
comprobanteMontoFacturado=10000.00
comprobantesEliminados=
codigo=                            # hidden sin valor
```

### Patrón inferido (ALTAMENTE PROBABLE pero no confirmado 100%) para otras secciones

Por la arquitectura del sistema (Java Struts clásico con convención `ver*.do` / `guardar*.do`), los demás formularios siguen el mismo patrón:

| Categoría | GET (ver) | POST (guardar) | idConcepto(s) |
|-----------|-----------|----------------|---------------|
| Indumentaria/Equipamiento | `verGastosInduEquip.do` | `guardarGastosInduEquip.do` ✅ confirmado | 1, 2 |
| Educación | `verGastosEducacion.do` | `guardarGastosEducacion.do` | por confirmar |
| Alquiler | `verAlquileres.do` | `guardarAlquileres.do` | por confirmar |
| Medicina prepaga | `verMedicinaPrepaga.do` | `guardarMedicinaPrepaga.do` | por confirmar |
| Primas de seguro | `verPrimasSeguro.do` | `guardarPrimasSeguro.do` | por confirmar |
| Donaciones | `verDonaciones.do` | `guardarDonaciones.do` | por confirmar |
| Servicio doméstico | `verServicioDomestico.do` | `guardarServicioDomestico.do` | por confirmar |
| Gastos médicos | `verGastosMedicos.do` | `guardarGastosMedicos.do` | por confirmar |
| Intereses hipotecarios | `verInteresesHipotecarios.do` | `guardarInteresesHipotecarios.do` | por confirmar |

**Instrucción**: construir una **capa de abstracción** (`ArcaFormAdapter`) que reciba la categoría y mapee a los endpoints y payload correctos. Los no confirmados se marcan con un flag `experimental: true` en el código, y se testean uno por uno cuando el usuario los use. Ver sección "Tareas pendientes" al final.

## Restricciones legales y éticas

- La clave fiscal **NUNCA** se loguea en texto plano, ni en base de datos, ni en logs
- Encriptación en reposo: **AES-256-GCM** con key derivada por usuario (KDF: Argon2id)
- La clave se descifra solo en memoria del worker al momento de usarla, se borra inmediatamente después
- En los Términos y Condiciones aparece claro que el usuario autoriza la automatización
- Rate limiting propio: máximo **1 request cada 800ms** al servidor de ARCA para no activar anti-bot
- Si ARCA responde con 403 / 429 / HTML de error, el worker **detiene la cola inmediatamente**

---

# Stack Técnico Obligatorio

Esto no se negocia:

## Frontend
- **Next.js 14** con App Router (no Pages Router)
- **TypeScript estricto** (`strict: true`, `noUncheckedIndexedAccess: true`)
- **Tailwind CSS** + **shadcn/ui** para componentes
- **React Hook Form** + **Zod** para forms y validación
- **TanStack Query (React Query)** para data fetching y cache
- **Jotai** para estado global cliente (el usuario tiene preferencia por Jotai sobre Zustand)
- **lucide-react** para iconos
- **react-dropzone** para upload de archivos
- **sonner** para toasts

## Backend
- **API Routes de Next.js** (app/api) — TypeScript
- **Supabase** (Postgres + Auth + Storage)
  - Auth para usuarios de la app (email/password + magic link)
  - Storage para las facturas subidas (bucket privado con RLS)
  - Postgres para jobs, deducciones, logs
- **BullMQ** + **Redis** (Upstash Redis en producción) para la cola de jobs
- **Playwright** (solo para login a ARCA, en el worker)
- **Axios** con `axios-cookiejar-support` + `tough-cookie` para los POSTs directos a ARCA
- **Anthropic SDK** (`@anthropic-ai/sdk`) — usar modelo `claude-sonnet-4-5` con visión
- **pdf-lib** + **pdf-parse** para manejar PDFs (convertir a imagen antes de mandar a Vision si hace falta)
- **sharp** para procesar imágenes

## Seguridad
- **@node-rs/argon2** para hashear passwords y derivar keys
- **Node crypto (AES-256-GCM)** para encriptar credenciales ARCA
- **zod** en toda entrada (frontend y backend)
- **rate-limiter-flexible** para rate limiting de la API
- Variables de entorno validadas con zod al arrancar (`env.ts`)

## DevOps
- **Yarn** como package manager (NO npm, el usuario tiene preferencia)
- **Husky** + **lint-staged** + **commitlint** con conventional commits
- **Jest** + **React Testing Library** para unit tests
- **Playwright Test** para E2E
- **Docker Compose** para dev local (Redis + Postgres)
- **Deploy**: Vercel (app) + Railway o Hetzner (worker con Redis, porque Vercel no soporta workers long-running)

## Arquitectura de código
- **Atomic Design** en componentes: `atoms/`, `molecules/`, `organisms/`, `templates/`
- **Archivos de máximo 80 líneas** — si se pasa, hay que refactorizar
- Principio de **separación de concerns**: lógica de negocio en `src/lib/`, UI en `src/components/`
- **No exportar default** excepto en páginas de Next.js
- Todo componente con `'use client'` o `'use server'` declarado explícitamente

---

# Estructura de carpetas requerida

```
siradig-auto-loader/
├── apps/
│   ├── web/                          # Next.js app
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── signup/page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx         # home dashboard
│   │   │   │   ├── facturas/
│   │   │   │   │   ├── page.tsx     # listado facturas
│   │   │   │   │   └── upload/page.tsx
│   │   │   │   ├── jobs/page.tsx    # estado de cargas
│   │   │   │   └── configuracion/
│   │   │   │       ├── page.tsx
│   │   │   │       └── credenciales-arca/page.tsx
│   │   │   ├── api/
│   │   │   │   ├── auth/            # callbacks Supabase
│   │   │   │   ├── facturas/
│   │   │   │   │   ├── upload/route.ts
│   │   │   │   │   ├── extract/route.ts    # llama a Claude Vision
│   │   │   │   │   └── [id]/route.ts
│   │   │   │   ├── jobs/
│   │   │   │   │   ├── enqueue/route.ts
│   │   │   │   │   └── [id]/status/route.ts
│   │   │   │   └── arca/
│   │   │   │       └── test-credentials/route.ts
│   │   │   └── layout.tsx
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── atoms/
│   │   │   │   ├── molecules/
│   │   │   │   ├── organisms/
│   │   │   │   └── templates/
│   │   │   ├── lib/
│   │   │   │   ├── supabase/
│   │   │   │   ├── anthropic/
│   │   │   │   │   ├── client.ts
│   │   │   │   │   └── extractFactura.ts
│   │   │   │   ├── crypto/
│   │   │   │   │   └── credentials.ts  # encrypt/decrypt AES-256-GCM
│   │   │   │   ├── queue/
│   │   │   │   │   └── bullmq.ts
│   │   │   │   └── env.ts
│   │   │   ├── hooks/
│   │   │   ├── atoms/                # Jotai atoms
│   │   │   └── types/
│   │   ├── tests/
│   │   └── package.json
│   │
│   └── worker/                       # Node worker (no Next)
│       ├── src/
│       │   ├── index.ts             # entry point
│       │   ├── processors/
│       │   │   └── cargarDeduccion.ts
│       │   ├── arca/
│       │   │   ├── login.ts         # Playwright
│       │   │   ├── session.ts       # cookie jar management
│       │   │   ├── keepalive.ts
│       │   │   └── adapters/
│       │   │       ├── base.ts
│       │   │       ├── indumentaria.ts
│       │   │       ├── educacion.ts
│       │   │       ├── alquiler.ts
│       │   │       ├── medicina.ts
│       │   │       └── ...
│       │   └── lib/
│       └── package.json
│
├── packages/
│   └── shared/                       # tipos y constantes compartidas
│       ├── src/
│       │   ├── types/
│       │   └── schemas/              # zod schemas
│       └── package.json
│
├── docker-compose.yml
├── package.json                      # workspace root
├── turbo.json                        # Turborepo
├── .env.example
├── README.md
└── CLAUDE.md                         # documentación para Claude Code
```

Usar **Turborepo** para el monorepo, **Yarn workspaces** para dependencias.

---

# Schema de base de datos (Supabase / Postgres)

```sql
-- Usuarios (manejado por Supabase Auth)
-- Tabla auth.users ya existe

-- Credenciales ARCA (una por usuario)
create table public.arca_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cuit text not null check (cuit ~ '^[0-9]{11}$'),
  clave_fiscal_encrypted text not null,        -- AES-256-GCM ciphertext (base64)
  clave_fiscal_iv text not null,               -- IV (base64)
  clave_fiscal_tag text not null,              -- auth tag (base64)
  last_used_at timestamptz,
  last_session_cookie text,                    -- JSESSIONID encriptada
  last_session_expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Facturas subidas
create table public.facturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,                  -- ruta en Supabase Storage
  original_filename text not null,
  mime_type text not null,
  size_bytes integer not null,
  
  -- datos extraídos por Claude Vision
  extracted_cuit text,
  extracted_razon_social text,
  extracted_tipo_comprobante text,             -- 'A', 'B', 'C', etc.
  extracted_punto_venta text,
  extracted_numero text,
  extracted_fecha_emision date,
  extracted_monto_total numeric(15, 2),
  extracted_categoria_sugerida text,           -- 'indumentaria', 'educacion', etc.
  extraction_confidence numeric(3, 2),         -- 0.00 - 1.00
  extraction_raw_response jsonb,               -- respuesta cruda de Claude
  
  -- datos editados por el usuario
  edited_cuit text,
  edited_razon_social text,
  edited_tipo_comprobante text,
  edited_punto_venta text,
  edited_numero text,
  edited_fecha_emision date,
  edited_monto_total numeric(15, 2),
  edited_categoria text,
  edited_mes_deduccion integer check (edited_mes_deduccion between 1 and 12),
  edited_id_concepto integer,                  -- id del concepto según categoría
  
  status text not null default 'uploaded' check (status in (
    'uploaded',         -- recién subida
    'extracting',       -- Claude Vision procesando
    'extracted',        -- datos extraídos, esperando edición
    'ready',            -- usuario validó, lista para cargar
    'queued',           -- en cola para cargar a ARCA
    'loading',          -- cargándose en ARCA
    'loaded',           -- cargada exitosamente
    'failed'            -- falló la carga
  )),
  error_message text,
  arca_deduccion_id text,                      -- id devuelto por ARCA post-carga
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_facturas_user_id on public.facturas(user_id);
create index idx_facturas_status on public.facturas(status);

-- Jobs de carga (1 job = 1 factura a cargar)
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

-- Log de auditoría
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

-- Row Level Security
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
```

---

# Detalles de implementación críticos

## 1. Claude Vision — Extracción de facturas

Usar modelo `claude-sonnet-4-5` con el siguiente prompt:

```typescript
const EXTRACTION_PROMPT = `Sos un asistente experto en facturas argentinas (ARCA/AFIP).
Te paso la imagen de una factura. Extrae los siguientes datos en formato JSON estricto.
Si algún dato no está o no se ve claro, devolvelo como null.

Responder SOLO con un JSON válido, sin texto antes ni después, con la siguiente estructura:

{
  "cuit_emisor": "20304050607",           // 11 dígitos sin guiones
  "razon_social": "EMPRESA SA",
  "tipo_comprobante": "A",                 // A, B, C, M, E, etc.
  "punto_venta": "0001",                   // 4-5 dígitos con ceros a la izquierda
  "numero_comprobante": "00012345",
  "fecha_emision": "2026-04-15",          // ISO 8601
  "monto_total": 12345.67,                 // número decimal
  "categoria_sugerida": "indumentaria",   // una de: indumentaria, equipamiento,
                                           //  educacion, alquiler, medicina_prepaga,
                                           //  primas_seguro, donaciones, servicio_domestico,
                                           //  gastos_medicos, intereses_hipotecarios, otro
  "confianza": 0.95,                       // 0.00 a 1.00, qué tan seguro estás
  "observaciones": "..."                  // null o texto corto si hay algo raro
}`;
```

- Pasar imagen como base64 con `media_type` correcto
- Para PDFs: convertir la primera página a imagen PNG con `pdf-lib` + `sharp` antes de mandar
- Validar la respuesta con Zod; si falla el JSON parse, reintentar 1 vez con prompt más estricto
- Guardar la respuesta cruda en `extraction_raw_response` para auditoría

## 2. Encriptación de credenciales ARCA

```typescript
// src/lib/crypto/credentials.ts
// AES-256-GCM con key derivada del master key + user_id (salt)

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const MASTER_KEY = process.env.CREDENTIALS_MASTER_KEY!; // 32 bytes hex

export function encryptCredential(plaintext: string, userId: string) {
  const salt = Buffer.from(userId);
  const key = scryptSync(MASTER_KEY, salt, 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decryptCredential(
  { ciphertext, iv, tag }: { ciphertext: string; iv: string; tag: string },
  userId: string
) {
  const salt = Buffer.from(userId);
  const key = scryptSync(MASTER_KEY, salt, 32);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
```

La master key se rota manualmente (documentar proceso en README).

## 3. Login a ARCA con Playwright

```typescript
// apps/worker/src/arca/login.ts
import { chromium } from 'playwright';

export async function loginToArca(cuit: string, claveFiscal: string) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ...',
  });
  const page = await context.newPage();
  
  await page.goto('https://auth.afip.gob.ar/contribuyente_/login.xhtml');
  await page.fill('#F1\\:username', cuit);
  await page.click('#F1\\:btnSiguiente');
  await page.waitForSelector('#F1\\:password');
  await page.fill('#F1\\:password', claveFiscal);
  await page.click('#F1\\:btnIngresar');
  
  // Esperar redirect al portal
  await page.waitForURL(/portalcf\.cloud\.afip\.gob\.ar/, { timeout: 15000 });
  
  // Navegar a SiRADIG (dispara SSO)
  await page.goto('https://serviciosjava2.afip.gob.ar/radig/jsp/verMenuEmpleado.do');
  await page.waitForSelector('#formulario, .menuPrincipal', { timeout: 15000 });
  
  // Extraer todas las cookies del dominio serviciosjava2
  const cookies = await context.cookies('https://serviciosjava2.afip.gob.ar');
  const jsessionid = cookies.find(c => c.name === 'JSESSIONID');
  
  await browser.close();
  
  if (!jsessionid) throw new Error('No se obtuvo JSESSIONID');
  return {
    jsessionid: jsessionid.value,
    expiresAt: new Date(Date.now() + 20 * 60 * 1000), // 20 min desde ahora
    allCookies: cookies,
  };
}
```

**IMPORTANTE sobre el login:**
- ARCA muestra a veces un CAPTCHA. Si el selector `#F1\\:captcha` aparece, el login falla y se notifica al usuario para que ingrese manualmente una vez (flujo "login asistido")
- Implementar reintento con backoff: 3 intentos máximo
- Tener un `user-agent` real, no el default de Playwright
- **NO** reutilizar el browser context entre usuarios — uno por sesión de login

## 4. Cargas HTTP directas

```typescript
// apps/worker/src/arca/adapters/base.ts
import axios, { AxiosInstance } from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

export abstract class ArcaFormAdapter {
  protected http: AxiosInstance;
  
  constructor(jsessionid: string) {
    const jar = new CookieJar();
    jar.setCookieSync(
      `JSESSIONID=${jsessionid}; Path=/radig; Secure; HttpOnly`,
      'https://serviciosjava2.afip.gob.ar'
    );
    this.http = wrapper(axios.create({
      jar,
      baseURL: 'https://serviciosjava2.afip.gob.ar',
      headers: {
        'User-Agent': 'Mozilla/5.0 ...',
        'Referer': 'https://serviciosjava2.afip.gob.ar/radig/jsp/verMenuDeducciones.do',
        'Origin': 'https://serviciosjava2.afip.gob.ar',
      },
      timeout: 15000,
    }));
  }
  
  abstract guardar(data: DeduccionInput): Promise<{ success: boolean; arcaId?: string; error?: string }>;
}
```

Cada adapter extiende de ahí. Para Indumentaria:

```typescript
// apps/worker/src/arca/adapters/indumentaria.ts
export class IndumentariaAdapter extends ArcaFormAdapter {
  async guardar(data: IndumentariaInput) {
    const body = new URLSearchParams({
      numeroDoc: data.cuit,
      razonSocial: data.razonSocial,
      idConcepto: String(data.concepto === 'indumentaria' ? 1 : 2),
      mesDesde: String(data.mes),
      montoTotal: data.monto.toFixed(2),
      numeroDocTmp: data.cuit,
      comprobanteIdFilaAgregada: '1',
      comprobanteFechaEmision: data.fechaEmision, // DD/MM/YYYY
      comprobanteTipo: String(data.tipoComprobante),
      comprobantePuntoVenta: data.puntoVenta.padStart(4, '0'),
      comprobanteNumero: data.numero.padStart(8, '0'),
      comprobanteNumeroAlternativo: '',
      comprobanteMontoFacturado: data.monto.toFixed(2),
      comprobantesEliminados: '',
      codigo: '',
    });
    
    const res = await this.http.post(
      '/radig/jsp/guardarGastosInduEquip.do',
      body.toString()
    );
    
    // ARCA responde con HTML (redirect o página de error)
    return this.parseResponse(res.data);
  }
}
```

## 5. Parseo de respuesta de ARCA

ARCA responde con HTML. Usar **cheerio** para detectar:
- Error: presencia de `.errorMessage`, `.error`, texto "Error" o "Código de error"
- Éxito: redirect a `verGastosInduEquip.do` con el listado actualizado conteniendo la fila nueva

```typescript
import * as cheerio from 'cheerio';

function parseArcaResponse(html: string) {
  const $ = cheerio.load(html);
  const errorEl = $('.errorMessage, .error').first();
  if (errorEl.length > 0) {
    return { success: false, error: errorEl.text().trim() };
  }
  // Detectar el id de la deducción recién agregada (último link eliminarDeduccion)
  const lastDelete = $('a[href*="eliminarDeduccion.do?id="]').last();
  const arcaId = lastDelete.attr('href')?.match(/id=(\d+)/)?.[1];
  return { success: true, arcaId };
}
```

## 6. Cola con BullMQ

```typescript
// apps/worker/src/processors/cargarDeduccion.ts
import { Worker, Job } from 'bullmq';

const worker = new Worker(
  'cargar-deduccion',
  async (job: Job) => {
    const { facturaId, userId } = job.data;
    // 1. Fetch factura desde DB
    // 2. Fetch credenciales y desencriptar
    // 3. Login (o reusar sesión si válida)
    // 4. Según categoría, instanciar adapter correspondiente
    // 5. Llamar adapter.guardar()
    // 6. Actualizar factura en DB con resultado
    // 7. Emitir evento realtime a Supabase para actualizar UI
  },
  {
    connection: redisConnection,
    concurrency: 2,                // bajo, para no sobrecargar ARCA
    limiter: {
      max: 1,
      duration: 800,               // 1 job cada 800ms
    },
  }
);
```

## 7. Updates en tiempo real

Usar **Supabase Realtime** para que el frontend escuche cambios en `facturas.status` sin polling.

## 8. Validaciones Zod compartidas

En `packages/shared/src/schemas/factura.ts`:

```typescript
import { z } from 'zod';

export const cuitSchema = z.string().regex(/^[0-9]{11}$/, 'CUIT debe tener 11 dígitos');

export const facturaEditedSchema = z.object({
  cuit: cuitSchema,
  razonSocial: z.string().min(1).max(200),
  tipoComprobante: z.enum(['A', 'B', 'C', 'M', 'E']),
  puntoVenta: z.string().regex(/^[0-9]{4,5}$/),
  numero: z.string().regex(/^[0-9]{1,8}$/),
  fechaEmision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  montoTotal: z.number().positive(),
  categoria: z.enum(['indumentaria', 'equipamiento', 'educacion', 'alquiler', 'medicina_prepaga', 'primas_seguro', 'donaciones', 'servicio_domestico', 'gastos_medicos', 'intereses_hipotecarios']),
  mesDeduccion: z.number().int().min(1).max(12),
});

export type FacturaEdited = z.infer<typeof facturaEditedSchema>;
```

---

# UI/UX requerida

## Páginas principales

### 1. `/login` y `/signup`
- Formularios simples con shadcn/ui
- Validación Zod
- Magic link opcional

### 2. `/` (Dashboard home)
- Cards con stats: "Facturas cargadas este año", "Pendientes", "Ahorro estimado en Ganancias"
- Gráfico con deducciones por categoría (usar Recharts)
- Timeline de últimas cargas

### 3. `/facturas/upload`
- Dropzone grande central con react-dropzone
- Acepta múltiples archivos, drag & drop o click
- Mientras se sube, muestra progress bar por archivo
- Al terminar upload, dispara extracción con Claude Vision en paralelo (hasta 3 simultáneas)
- Cada archivo pasa a mostrarse en una card con estado: "Extrayendo..." → "Lista para revisar"

### 4. `/facturas` (listado + editor)
- Tabla con todas las facturas, filtrable por estado
- Cada fila editable inline (click en celda → input)
- Columna "Acciones": ver archivo original, eliminar
- Botón grande arriba: "Cargar seleccionadas a SiRADIG" (solo las en estado `ready`)
- Checkboxes para selección múltiple

### 5. `/jobs`
- Lista de jobs en curso y completados
- Estado en tiempo real (Supabase Realtime)
- Para los fallidos, botón "Reintentar" y detalle del error

### 6. `/configuracion/credenciales-arca`
- Form con CUIT y clave fiscal
- Botón "Probar conexión" que dispara un login de prueba
- Checkbox: "Recordar credenciales de forma encriptada" (si off, pide cada vez)
- Advertencia clara sobre seguridad

## Design system
- Colores: usar paleta primaria **indigo** (shadcn default), acento **emerald** para éxitos
- Modo oscuro/claro obligatorio con next-themes
- Mobile-first, responsive
- Usar emoji + colores de estado: 🟢 loaded, 🟡 queued/loading, 🔴 failed, 🔵 ready
- Animaciones suaves con **framer-motion** (solo en interacciones clave, no por default)

---

# Tareas pendientes para resolver durante el desarrollo

Estas son cosas que quedaron sin confirmar al 100% en el spike y que hay que resolver **durante el desarrollo**:

## TAREA 1 — Mapear endpoints de las otras categorías
**Prioridad: ALTA**
- Durante desarrollo, loguearse manualmente a SiRADIG y navegar cada tipo de deducción
- Inspeccionar el atributo `action` del formulario (`document.querySelector('#formulario').action`)
- Documentar los campos de cada uno en `apps/worker/src/arca/adapters/<categoria>.ts`
- Crear un script helper `scripts/inspect-arca-form.ts` que use Playwright para extraer estos datos automáticamente

## TAREA 2 — Validar codes de `idConcepto` para cada categoría
**Prioridad: ALTA**
- Para cada select `idConcepto`, listar todos los `<option value>` y su label
- Crear enum TypeScript en `packages/shared/src/types/arca.ts`

## TAREA 3 — Manejo de CAPTCHA en login
**Prioridad: MEDIA**
- Detectar presencia de CAPTCHA en login
- Si aparece: modo "login asistido" — se muestra al usuario el iframe de ARCA para que resuelva manualmente, luego se capturan las cookies
- Alternativa: servicio externo (2Captcha) — evaluar costo/beneficio

## TAREA 4 — Manejo de validaciones server-side de ARCA
**Prioridad: MEDIA**
- ARCA valida: CUIT existente en padrón, fecha no futura, monto > 0, tipo comprobante válido para el CUIT
- Parsear los mensajes de error específicos y traducirlos a errores amigables para el usuario
- Crear un diccionario de errores conocidos en `apps/worker/src/arca/errorMessages.ts`

## TAREA 5 — Rate limiting adaptativo
**Prioridad: BAJA**
- Si ARCA empieza a devolver 503 o "Servicio no disponible", aumentar el delay entre requests automáticamente
- Si 3 errores seguidos del mismo tipo, pausar la cola 5 minutos

## TAREA 6 — Edición de deducciones ya cargadas
**Prioridad: BAJA (post-MVP)**
- Permitir al usuario editar/eliminar deducciones que ya están en SiRADIG
- Requiere mapear el endpoint de edición (probablemente `editarDeduccion.do?id=X`)

## TAREA 7 — Envío final del formulario F572
**Prioridad: BAJA (post-MVP)**
- Después de cargar todas las deducciones, el usuario debe presionar "Enviar formulario" en ARCA para que quede firme ante el empleador
- Mapear el endpoint de envío
- Ofrecer botón en la app: "Enviar formulario F572 a mi empleador"

---

# Variables de entorno (.env.example)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Redis (Upstash)
REDIS_URL=
REDIS_TOKEN=

# Crypto
CREDENTIALS_MASTER_KEY=          # 64 hex chars (32 bytes)

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Worker
WORKER_CONCURRENCY=2
ARCA_RATE_LIMIT_MS=800
```

---

# Criterios de aceptación del MVP

El MVP está listo cuando:

1. ✅ Un usuario puede registrarse, loguearse, y configurar sus credenciales ARCA
2. ✅ Puede subir una imagen o PDF de factura
3. ✅ Claude Vision extrae los datos con >80% de precisión en facturas típicas argentinas
4. ✅ Puede editar los datos en una tabla y marcarlos como "listos"
5. ✅ Puede cargar esas deducciones a SiRADIG para la categoría **Indumentaria/Equipamiento** (las otras pueden ser post-MVP si se demoran)
6. ✅ Ve el estado en tiempo real (uploaded → extracted → ready → queued → loaded)
7. ✅ Si falla, ve el mensaje de error de ARCA en texto claro
8. ✅ Los tests unitarios pasan (>70% coverage en lib/ y adapters/)
9. ✅ El E2E básico pasa: signup → upload → extract → edit → load (mockeando ARCA)
10. ✅ El deploy funciona: web en Vercel, worker en Railway, BD en Supabase

---

# Convenciones de código

- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)
- **Branches**: `main` → producción, `develop` → staging, `feature/xxx`, `fix/xxx`
- **PRs**: Obligatorio code review (al menos 1 aprobación), checks verdes, squash merge
- **Comentarios en código**: solo cuando el "por qué" no es obvio. Nunca "qué" hace el código
- **Idioma**: Código en inglés, comentarios y strings de UI en español (Rioplatense)
- **Logs**: usar **pino** con niveles (debug, info, warn, error). Nunca loguear secrets
- **Errors**: crear clases custom (`ArcaLoginError`, `ArcaRateLimitError`, `ExtractionError`), no usar `new Error()` genérico

---

# Qué NO hacer

- ❌ No usar Redux, MobX, ni otra lib de estado — solo Jotai
- ❌ No usar Pages Router de Next.js — solo App Router
- ❌ No usar CSS Modules ni styled-components — solo Tailwind
- ❌ No guardar la clave fiscal en localStorage ni en sessionStorage del navegador
- ❌ No usar `any` en TypeScript (usar `unknown` + type guards cuando sea necesario)
- ❌ No hacer scraping con Playwright para el guardado de deducciones — solo HTTP directo
- ❌ No cachear el `JSESSIONID` más de 20 minutos
- ❌ No hacer requests paralelos a ARCA — siempre secuencial con rate limit
- ❌ No ignorar errores: todo error debe loguearse y propagarse al usuario

---

# Entregables esperados (en este orden)

1. **Estructura inicial del monorepo** (Turborepo + yarn workspaces)
2. **`packages/shared`**: tipos y schemas zod
3. **Schema SQL de Supabase** (archivo `supabase/migrations/0001_init.sql`)
4. **`apps/web`** — UI completa con auth, upload, listado y config
5. **`apps/web`** — integración con Claude Vision para extracción
6. **`apps/worker`** — módulo de login a ARCA con Playwright
7. **`apps/worker`** — adapter de Indumentaria (categoría base, confirmada)
8. **`apps/worker`** — cola BullMQ y procesador principal
9. **Tests unitarios** para crypto, adapters y extractor
10. **Tests E2E** del flujo principal (mockeando ARCA)
11. **Docker Compose** para desarrollo local
12. **README completo** con setup, arquitectura y troubleshooting
13. **CLAUDE.md** con convenciones del proyecto para futuro uso con Claude Code
14. **Scripts** en `scripts/` para: inspeccionar formularios ARCA, rotar master key, seed de datos

---

# Empezar por

1. Confirmá entendimiento listando los 14 entregables y preguntando lo que no esté claro
2. Generá el monorepo base con Turborepo
3. Luego seguí el orden de entregables

**No avances al siguiente entregable hasta que el anterior esté funcionando y testeado.**

Si en algún momento necesitás tomar una decisión de diseño que no está especificada acá, elegí la opción más **simple**, **segura** y **mantenible**, y documentá la decisión en un archivo `DECISIONS.md`.

---

FIN DEL PROMPT.
