create table if not exists public.workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

revoke all on public.workspaces from anon;
grant select, insert, update on public.workspaces to authenticated;

create policy "Owners can read their workspace"
  on public.workspaces for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can create their workspace"
  on public.workspaces for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Owners can update their workspace"
  on public.workspaces for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
