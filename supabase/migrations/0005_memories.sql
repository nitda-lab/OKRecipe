create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists memories_user_idx on memories (user_id, created_at desc);

alter table memories enable row level security;

create policy "own memories select" on memories
  for select using (auth.uid() = user_id);
create policy "own memories insert" on memories
  for insert with check (auth.uid() = user_id);
create policy "own memories delete" on memories
  for delete using (auth.uid() = user_id);
