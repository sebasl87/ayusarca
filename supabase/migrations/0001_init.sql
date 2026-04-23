create extension if not exists "pgcrypto";

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

create table public.facturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes integer not null,
  extracted_cuit text,
  extracted_razon_social text,
  extracted_tipo_comprobante text,
  extracted_punto_venta text,
  extracted_numero text,
  extracted_fecha_emision date,
  extracted_monto_total numeric(15, 2),
  extracted_categoria_sugerida text,
  extraction_confidence numeric(3, 2),
  extraction_raw_response jsonb,
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
    'uploaded',
    'extracting',
    'extracted',
    'ready',
    'queued',
    'loading',
    'loaded',
    'failed'
  )),
  error_message text,
  arca_deduccion_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_facturas_user_id on public.facturas(user_id);
create index idx_facturas_status on public.facturas(status);

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

-- Storage
insert into storage.buckets (id, name, public)
  values ('facturas', 'facturas', false)
  on conflict (id) do nothing;

create policy "facturas_storage_all" on storage.objects
  for all using (
    bucket_id = 'facturas'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'facturas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
