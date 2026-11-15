-- Independent learning progress; XP remains server-scored by the existing drill RPC.
create table public.ikigai_hyogen_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 key text not null check(length(key) between 1 and 100),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=131072),
 primary key(user_id,key)
);
alter table public.ikigai_hyogen_progress enable row level security;
revoke all on public.ikigai_hyogen_progress from public,anon,authenticated;
grant select,insert,update on public.ikigai_hyogen_progress to authenticated;
create policy hyogen_progress_select on public.ikigai_hyogen_progress for select to authenticated
 using(user_id=(select auth.uid()) and coalesce((select auth.jwt())->>'is_anonymous','false')<>'true');
create policy hyogen_progress_insert on public.ikigai_hyogen_progress for insert to authenticated
 with check(user_id=(select auth.uid()) and coalesce((select auth.jwt())->>'is_anonymous','false')<>'true');
create policy hyogen_progress_update on public.ikigai_hyogen_progress for update to authenticated
 using(user_id=(select auth.uid()) and coalesce((select auth.jwt())->>'is_anonymous','false')<>'true')
 with check(user_id=(select auth.uid()) and coalesce((select auth.jwt())->>'is_anonymous','false')<>'true');
