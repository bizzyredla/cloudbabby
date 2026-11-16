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

-- Watchlist: colleagues and what they own that you'd go after if they leave.
create or replace view public.colleagues with (security_invoker = true) as
select
  substring(key from 5)          as id,
  data->>'name'                  as name,
  data->>'status'                as status,
  data->>'departed_at'           as departed_at,
  data->>'created_at'            as created_at
from public.records
where key like 'col:%' and not deleted and data is not null;

create or replace view public.watchlist_items with (security_invoker = true) as
select
  substring(key from 4)          as id,
  data->>'name'                  as name,
  data->>'salesforce_url'        as salesforce_url,
  data->>'type'                  as type,
  data->>'colleague_id'          as colleague_id,
  data->>'why_i_want_it'         as why_i_want_it,
  data->>'status'                as status,
  data->>'window_opened_at'      as window_opened_at,
  data->>'created_at'            as created_at
from public.records
where key like 'wl:%' and not deleted and data is not null;

revoke all on public.colleagues, public.watchlist_items from anon;
grant select on public.colleagues, public.watchlist_items to authenticated;

-- Imports (staging): uploaded lists and their rows. Rows never write to accounts on their own.
create or replace view public.import_lists with (security_invoker = true) as
select
  substring(key from 5)          as id,
  data->>'source'                as source,
  data->>'file_name'             as file_name,
  data->>'notes'                 as notes,
  (data->>'row_count')::int      as row_count,
  data->>'created_at'            as created_at
from public.records
where key like 'imp:%' and not deleted and data is not null;

create or replace view public.list_items with (security_invoker = true) as
select
  substring(key from 5)                        as id,
  data->>'list_id'                             as list_id,
  data->'raw'                                  as raw,
  nullif(data->>'matched_account_id', '')      as matched_account_id,
  data->>'match_confidence'                    as match_confidence,
  data->>'match_reason'                        as match_reason,
  data->>'status'                              as status,
  data->>'note'                                as note,
  nullif(data->>'promoted_account_id', '')     as promoted_account_id,
  data->>'created_at'                          as created_at
from public.records
where key like 'imr:%' and not deleted and data is not null;

revoke all on public.import_lists, public.list_items from anon;
grant select on public.import_lists, public.list_items to authenticated;
