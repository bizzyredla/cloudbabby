-- Mini CRM cloud sync. Run this once in your Supabase project's SQL Editor.
-- It is safe to run again.
--
-- Every Mini CRM record (account, contact, activity, task, planner day, ...) is one row.
-- Row level security lets a signed-in user read and write only their own rows.

create sequence if not exists public.records_seq;

create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  key        text        not null,            -- record id with a type prefix, e.g. a:..., c:..., t:...
  parent     text,                            -- account id, for contacts, activities and key dates
  data       jsonb,                           -- the record; null once deleted
  ts         bigint      not null default 0,  -- when it was last edited on a device (ms)
  deleted    boolean     not null default false,
  base       bigint      not null default 0,  -- the version (seq) the device had when it made this edit
  wid        text,                            -- id of the write, so the device can tell it was accepted
  seq        bigint      not null default 0,  -- version number, set by the trigger below
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create index if not exists records_user_seq on public.records (user_id, seq);

-- Give each accepted write the next version number. A write made from an out-of-date copy is
-- left out (the stored row is kept); the device then downloads the newer row, merges and retries.
create or replace function public.records_stamp() returns trigger
language plpgsql as $$
begin
  -- One writer at a time per user, so version numbers appear in the order they are saved.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if tg_op = 'UPDATE' and old.seq > new.base then
    return old;
  end if;
  new.seq := nextval('public.records_seq');
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists records_stamp on public.records;
create trigger records_stamp before insert or update on public.records
  for each row execute function public.records_stamp();

alter table public.records enable row level security;

drop policy if exists "read own records" on public.records;
create policy "read own records" on public.records
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "add own records" on public.records;
create policy "add own records" on public.records
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "change own records" on public.records;
create policy "change own records" on public.records
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.records from anon;
grant select, insert, update on public.records to authenticated;
grant usage on sequence public.records_seq to authenticated;
