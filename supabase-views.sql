-- Bbars OS: read-only views over the records table, so the CRM's data can be looked at as
-- ordinary tables in the Supabase dashboard (Table editor or SQL editor).
--
-- The app itself never reads or writes these views. It keeps every record as one JSON row in
-- public.records (see supabase-setup.sql): that's what lets it work offline and merge edits from
-- your phone and computer. New fields and record types therefore need no table migration; this
-- file only adds views. Run it once in the Supabase SQL editor after supabase-setup.sql, and
-- again whenever this file changes (every statement is safe to re-run).
--
-- security_invoker makes each view run with the reader's permissions, so the records table's
-- row-level security still applies: you only ever see your own rows.

-- Accounts, with the Active / Reserve book.
create or replace view public.accounts with (security_invoker = true) as
select
  substring(key from 3)                          as id,
  data->>'name'                                  as name,
  data->>'type'                                  as type,
  data->>'stage'                                 as stage,
  coalesce(data->>'book', 'active')              as book,
  data->>'website'                               as website,
  data->>'location'                              as location,
  data->>'liId'                                  as linkedin_company_id,
  data->>'nextFollowUp'                          as next_follow_up,
  data->>'revisitDate'                           as revisit_date,
  data->>'createdAt'                             as created_at,
  updated_at
from public.records
where key like 'a:%' and not deleted and data is not null;

revoke all on public.accounts from anon;
grant select on public.accounts to authenticated;
