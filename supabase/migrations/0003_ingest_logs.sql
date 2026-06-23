create table if not exists ingest_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('receipt', 'fridge')),
  image_path text,
  ai_raw_json text,
  status text not null default 'extracted',
  created_at timestamptz not null default now()
);

create index if not exists ingest_logs_user_idx on ingest_logs (user_id, created_at desc);

alter table ingest_logs enable row level security;

create policy "own ingest_logs select" on ingest_logs
  for select using (auth.uid() = user_id);
create policy "own ingest_logs insert" on ingest_logs
  for insert with check (auth.uid() = user_id);
