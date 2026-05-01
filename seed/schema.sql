create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('sentence', 'minimal_pair', 'vocab')),
  content text not null,
  difficulty int default 1 check (difficulty between 1 and 5),
  tags text[] default '{}',
  created_at timestamptz default now()
);

create table if not exists recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  audio_url text,
  transcript text not null,
  target_text text not null,
  ai_feedback jsonb not null,
  created_at timestamptz default now()
);

create index if not exists recordings_user_created on recordings(user_id, created_at desc);

alter table items enable row level security;
alter table recordings enable row level security;

drop policy if exists "Authenticated users can read items" on items;
create policy "Authenticated users can read items"
  on items for select
  to authenticated
  using (true);

drop policy if exists "Users can read own recordings" on recordings;
create policy "Users can read own recordings"
  on recordings for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own recordings" on recordings;
create policy "Users can insert own recordings"
  on recordings for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own recordings" on recordings;
create policy "Users can update own recordings"
  on recordings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own recordings" on recordings;
create policy "Users can delete own recordings"
  on recordings for delete
  to authenticated
  using (auth.uid() = user_id);
