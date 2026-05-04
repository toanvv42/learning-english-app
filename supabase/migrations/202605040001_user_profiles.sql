create table if not exists user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into user_profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.create_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function public.create_user_profile();

create or replace function public.touch_user_profile_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_user_profiles_updated_at on user_profiles;
create trigger on_user_profiles_updated_at
  before update on user_profiles
  for each row execute function public.touch_user_profile_updated_at();

alter table user_profiles enable row level security;

drop policy if exists "Users can read own profile" on user_profiles;
create policy "Users can read own profile"
  on user_profiles for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create own free profile" on user_profiles;
create policy "Users can create own free profile"
  on user_profiles for insert
  to authenticated
  with check (auth.uid() = user_id and plan = 'free');

notify pgrst, 'reload schema';
