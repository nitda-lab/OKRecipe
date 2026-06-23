-- 食材マスタ（将来の正規化用。本マイルストーンでは任意参照）
create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  default_unit text
);

-- 在庫
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  quantity_text text not null,
  quantity_num numeric,
  unit_text text,
  expires_at date,
  source text not null default 'manual'
    check (source in ('receipt', 'fridge_photo', 'manual', 'chat')),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_items_user_idx on inventory_items (user_id);

-- 行レベルセキュリティ: 自分の在庫だけ読み書き可
alter table inventory_items enable row level security;

create policy "own inventory select" on inventory_items
  for select using (auth.uid() = user_id);
create policy "own inventory insert" on inventory_items
  for insert with check (auth.uid() = user_id);
create policy "own inventory update" on inventory_items
  for update using (auth.uid() = user_id);
create policy "own inventory delete" on inventory_items
  for delete using (auth.uid() = user_id);
