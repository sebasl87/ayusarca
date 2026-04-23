# ayusarca (SiRADIG Auto-Loader)

Monorepo (Turborepo + Yarn Workspaces) con:
- `apps/web`: Next.js (App Router) para carga/extracción/edición de facturas y encolado de jobs.
- `apps/worker`: worker Node (BullMQ) para cargar deducciones en ARCA.
- `packages/shared`: tipos, schemas y utilidades compartidas.

## Requisitos

- Node.js 20+
- Corepack habilitado
- Docker (para Redis/Postgres local)
- Un proyecto Supabase (Auth + DB + Storage)

## Setup

1) Instalar dependencias

```bash
corepack enable
yarn install
```

2) Variables de entorno

- Copiar `.env.example` a `.env` (raíz) y completar:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ANTHROPIC_API_KEY`
  - `CREDENTIALS_MASTER_KEY` (hex 32 bytes)
  - `REDIS_URL`

3) Levantar servicios locales

```bash
docker compose up -d
```

4) Crear schema en Supabase (DB)

- Abrir el SQL editor de Supabase y ejecutar [0001_init.sql](file:///Users/sebastianloguzzo/mine/ayusarca/supabase/migrations/0001_init.sql).

5) Crear bucket de Storage

- Crear un bucket llamado `facturas`.
- Agregar policies en `storage.objects` para que cada usuario pueda subir/leer sus archivos bajo el prefijo `{user_id}/...`.

Ejemplo (ajustar si cambiás el nombre del bucket):

```sql
create policy "facturas_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'facturas'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "facturas_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'facturas'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

## Desarrollo

```bash
yarn dev
```

## Scripts útiles

- `yarn lint`
- `yarn typecheck`
- `yarn test`
- `yarn inspect-arca-form` (Playwright; requiere variables locales para ARCA)
