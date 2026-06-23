create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists recipes_user_idx on recipes (user_id, created_at desc);

alter table recipes enable row level security;

create policy "own recipes select" on recipes
  for select using (auth.uid() = user_id);
create policy "own recipes insert" on recipes
  for insert with check (auth.uid() = user_id);
create policy "own recipes delete" on recipes
  for delete using (auth.uid() = user_id);
