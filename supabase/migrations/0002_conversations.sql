-- 会話スレッド
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '新しい会話',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_idx on conversations (user_id, updated_at desc);

-- 各発言
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_idx on chat_messages (conversation_id, created_at);

-- 行レベルセキュリティ: 本人のみ
alter table conversations enable row level security;
alter table chat_messages enable row level security;

create policy "own conversations select" on conversations
  for select using (auth.uid() = user_id);
create policy "own conversations insert" on conversations
  for insert with check (auth.uid() = user_id);
create policy "own conversations update" on conversations
  for update using (auth.uid() = user_id);
create policy "own conversations delete" on conversations
  for delete using (auth.uid() = user_id);

create policy "own chat_messages select" on chat_messages
  for select using (auth.uid() = user_id);
create policy "own chat_messages insert" on chat_messages
  for insert with check (auth.uid() = user_id);
create policy "own chat_messages delete" on chat_messages
  for delete using (auth.uid() = user_id);
