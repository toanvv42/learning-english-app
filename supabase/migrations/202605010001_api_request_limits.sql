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

alter table api_request_limits enable row level security;

notify pgrst, 'reload schema';
