-- Rebalance display ranks only. Student XP and historical achievements are preserved.
create or replace function public.ikigai_record_hall_of_fame()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
 if new.role = 'student' and new.xp >= 85001 then
  insert into public.ikigai_world_hall_of_fame
   (user_id,nickname,level,title,japanese_title,xp_at_achievement)
  values(new.user_id,new.nickname,10,'Huyền Thoại IKIGAI','IKIGAIの伝説',new.xp)
  on conflict(user_id) do update set nickname=excluded.nickname,
   xp_at_achievement=greatest(public.ikigai_world_hall_of_fame.xp_at_achievement,excluded.xp_at_achievement);
 end if;
 return new;
end;
$$;
-- Resolve the explicitly named admin by verified server-owned role, never by nickname alone.
lock table public.ikigai_world_profiles in share row exclusive mode;
create temp table rank_xp_before on commit drop as
 select user_id,xp from public.ikigai_world_profiles;
do $$
declare admin_id uuid; matches integer;
begin
 select count(*), (array_agg(p.user_id))[1] into matches,admin_id
 from public.ikigai_world_profiles p join auth.users u on u.id=p.user_id
 where p.nickname='リー先生' and p.role='teacher' and u.raw_app_meta_data->>'role'='teacher';
 if matches<>1 then raise exception 'Expected exactly one verified リー先生 admin'; end if;
 update public.ikigai_world_profiles set xp=greatest(xp,100000),updated_at=now() where user_id=admin_id;
 if exists(select 1 from rank_xp_before b join public.ikigai_world_profiles p using(user_id)
  where b.user_id<>admin_id and b.xp is distinct from p.xp) then
  raise exception 'Non-admin XP changed; rollback';
 end if;
end;
$$;

revoke execute on function public.ikigai_record_hall_of_fame() from public,anon,authenticated;
