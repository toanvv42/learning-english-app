create table if not exists user_gemini_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_key text not null,
  iv text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table user_gemini_keys enable row level security;

drop policy if exists "Users can read own Gemini key metadata" on user_gemini_keys;
create policy "Users can read own Gemini key metadata"
  on user_gemini_keys for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own Gemini key" on user_gemini_keys;
create policy "Users can insert own Gemini key"
  on user_gemini_keys for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own Gemini key" on user_gemini_keys;
create policy "Users can update own Gemini key"
  on user_gemini_keys for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own Gemini key" on user_gemini_keys;
create policy "Users can delete own Gemini key"
  on user_gemini_keys for delete
  to authenticated
  using (auth.uid() = user_id);
