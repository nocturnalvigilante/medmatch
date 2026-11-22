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

-- v2 security pass: explicit grants. Signed-in users get only the verbs the app uses; anon gets nothing.
revoke all on table cabinet from anon;
revoke all on table cabinet from authenticated;
grant select, insert, delete on table cabinet to authenticated;

-- v2 security review: cap row size so one account can't store unbounded data.
alter table cabinet drop constraint if exists matches_size;
alter table cabinet drop constraint if exists brand_len;
alter table cabinet add constraint matches_size check (pg_column_size(matches) < 20000);
alter table cabinet add constraint brand_len check (char_length(brand) <= 120);

-- v2: "Was this right?" feedback from result pages (error analysis on real use).
-- Anyone can send feedback; nobody can read it through the API (view it in the Supabase dashboard).
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  brand text not null check (char_length(brand) <= 120),
  ingredients text check (char_length(ingredients) <= 400),
  verdict text not null check (verdict in ('right', 'wrong')),
  comment text check (char_length(comment) <= 500),
  source text check (char_length(source) <= 20)
);
alter table feedback enable row level security;
revoke all on table feedback from anon;
revoke all on table feedback from authenticated;
grant insert on table feedback to anon, authenticated;
drop policy if exists "anyone can send feedback" on feedback;
create policy "anyone can send feedback" on feedback for insert to anon, authenticated with check (true);
