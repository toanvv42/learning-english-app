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

create table if not exists user_gemini_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_key text not null,
  iv text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists api_request_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  route text not null,
  window_start timestamptz not null,
  request_count int not null default 0 check (request_count >= 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, route, window_start)
);

create index if not exists api_request_limits_window
  on api_request_limits(window_start);

create or replace function check_user_rate_limit(
  p_route text,
  p_limit int,
  p_window_seconds int
)
returns table (
  allowed boolean,
  remaining int,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_window_start timestamptz;
  v_request_count int;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if p_route is null or length(trim(p_route)) = 0 then
    raise exception 'Rate limit route is required';
  end if;

  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit configuration';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into api_request_limits (user_id, route, window_start, request_count)
  values (v_user_id, p_route, v_window_start, 1)
  on conflict (user_id, route, window_start)
  do update set
    request_count = api_request_limits.request_count + 1,
    updated_at = now()
  returning request_count into v_request_count;

  return query select
    v_request_count <= p_limit,
    greatest(p_limit - v_request_count, 0),
    v_window_start + make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function check_user_rate_limit(text, int, int) from public;
grant execute on function check_user_rate_limit(text, int, int) to authenticated;

alter table items enable row level security;
alter table recordings enable row level security;
alter table api_request_limits enable row level security;
alter table user_gemini_keys enable row level security;

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
