-- Feed : synchronisation des votes et favoris
-- A coller dans Supabase > SQL Editor > New query > Run

create table if not exists public.interactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  vote smallint not null default 0,
  favorite boolean not null default false,
  rank int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, url)
);

alter table public.interactions enable row level security;

drop policy if exists "own rows read" on public.interactions;
drop policy if exists "own rows insert" on public.interactions;
drop policy if exists "own rows update" on public.interactions;
drop policy if exists "own rows delete" on public.interactions;

create policy "own rows read" on public.interactions
  for select using (auth.uid() = user_id);

create policy "own rows insert" on public.interactions
  for insert with check (auth.uid() = user_id);

create policy "own rows update" on public.interactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows delete" on public.interactions
  for delete using (auth.uid() = user_id);

create index if not exists interactions_user_idx on public.interactions(user_id);
