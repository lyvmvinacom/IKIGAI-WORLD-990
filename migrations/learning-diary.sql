create schema if not exists private;
revoke all on schema private from public,anon;
-- Daily diary: all times are assigned by the server in Vietnam time.
create table public.ikigai_learning_diary (
 user_id uuid not null references auth.users(id) on delete cascade,
 day date not null, room text not null, activity text not null,
 online_seconds numeric not null default 0 check (online_seconds >= 0),
 first_seen timestamptz not null, last_seen timestamptz not null,
 primary key(user_id,day,room,activity)
);
create index ikigai_learning_diary_day on public.ikigai_learning_diary(day,user_id);
alter table public.ikigai_learning_diary enable row level security;
revoke all on public.ikigai_learning_diary from anon,authenticated;
grant select on public.ikigai_learning_diary to authenticated;
create policy teacher_read_diary on public.ikigai_learning_diary for select to authenticated
 using ((select auth.jwt()->'app_metadata'->>'role')='teacher' and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false));
create table private.ikigai_diary_clock (
 user_id uuid primary key references auth.users(id) on delete cascade,
 seen_at timestamptz not null, active boolean not null,
 room text not null, activity text not null
);
alter table private.ikigai_diary_clock enable row level security;
revoke all on private.ikigai_diary_clock from public,anon,authenticated;
create function private.ikigai_diary_ping(p_room text,p_activity text,p_active boolean)
returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); t timestamptz:=clock_timestamp(); c private.ikigai_diary_clock%rowtype;
 a timestamptz; b timestamptz; d date; r text; label text;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required' using errcode='42501'; end if;
 r:=case when p_room in ('map','class','arena','n4','n5','jft','gym','tea') then p_room else 'map' end;
 label:=left(trim(coalesce(p_activity,'')),180);
 -- One cursor per account, serialized even across devices and browser tabs.
 perform pg_advisory_xact_lock(hashtextextended(u::text,9127));
 t:=clock_timestamp();
 select * into c from private.ikigai_diary_clock where user_id=u;
 if found and c.active and t-c.seen_at between interval '0 seconds' and interval '45 seconds' then
  a:=c.seen_at;
  while a<t loop
   d:=(a at time zone 'Asia/Ho_Chi_Minh')::date;
   b:=least(t,((d+1)::timestamp at time zone 'Asia/Ho_Chi_Minh'));
   insert into public.ikigai_learning_diary values(u,d,c.room,c.activity,extract(epoch from b-a),a,b)
   on conflict(user_id,day,room,activity) do update set online_seconds=ikigai_learning_diary.online_seconds+excluded.online_seconds,last_seen=greatest(ikigai_learning_diary.last_seen,excluded.last_seen);
   a:=b;
  end loop;
 end if;
 if p_active then
  insert into public.ikigai_learning_diary values(u,(t at time zone 'Asia/Ho_Chi_Minh')::date,r,label,0,t,t)
  on conflict(user_id,day,room,activity) do update set last_seen=greatest(ikigai_learning_diary.last_seen,excluded.last_seen);
 end if;
 insert into private.ikigai_diary_clock values(u,t,coalesce(p_active,false),r,label)
 on conflict(user_id) do update set seen_at=t,active=excluded.active,room=r,activity=label;
end $$;
revoke all on function private.ikigai_diary_ping(text,text,boolean) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.ikigai_diary_ping(text,text,boolean) to authenticated;
create function public.ikigai_diary_ping(p_room text,p_activity text default '',p_active boolean default true)
returns void language sql security invoker set search_path='' as $$ select private.ikigai_diary_ping(p_room,p_activity,p_active) $$;
revoke all on function public.ikigai_diary_ping(text,text,boolean) from public,anon;
grant execute on function public.ikigai_diary_ping(text,text,boolean) to authenticated;
