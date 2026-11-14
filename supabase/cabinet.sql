-- Run once in Supabase → SQL Editor. Each row belongs to one Clerk user; RLS hides everyone else's.
create table if not exists cabinet (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt()->>'sub'),
  med_id text not null,
  brand text not null,
  matches jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, med_id)
);

alter table cabinet enable row level security;

drop policy if exists "own rows" on cabinet;
create policy "own rows" on cabinet for all to authenticated
  using (user_id = (auth.jwt()->>'sub'))
  with check (user_id = (auth.jwt()->>'sub'));
