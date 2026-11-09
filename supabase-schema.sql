-- IKIGAI WORLD 3.2: persistent player profile + server-authoritative rewards
-- Run this whole file once in Supabase SQL Editor. Do not expose service_role keys in the browser.
create table if not exists public.ikigai_world_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default 'Học viên',
  role text not null default 'student' check (role in ('student','teacher')),
  gender text not null default 'male' check (gender in ('male','female')),
  avatar integer not null default 0 check (avatar between 0 and 1),
  xp integer not null default 0 check (xp >= 0),
  coins integer not null default 0 check (coins >= 0),
  updated_at timestamptz not null default now()
);
alter table public.ikigai_world_profiles enable row level security;
drop policy if exists "Player reads own profile" on public.ikigai_world_profiles;
drop policy if exists "Teachers read all profiles" on public.ikigai_world_profiles;
create policy "Player reads own profile" on public.ikigai_world_profiles for select to authenticated using (auth.uid() = user_id);
create policy "Teachers read all profiles" on public.ikigai_world_profiles for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher');

create table if not exists public.ikigai_world_quiz_attempts (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  correct_count integer not null, total_count integer not null, xp_awarded integer not null,
  coins_awarded integer not null, created_at timestamptz not null default now()
);
alter table public.ikigai_world_quiz_attempts enable row level security;
drop policy if exists "Player reads own quiz attempts" on public.ikigai_world_quiz_attempts;
create policy "Player reads own quiz attempts" on public.ikigai_world_quiz_attempts for select to authenticated using (auth.uid() = user_id);

create or replace function public.ikigai_ensure_profile(p_nickname text, p_gender text, p_avatar integer)
returns public.ikigai_world_profiles language plpgsql security definer set search_path=public,auth as $$
declare r public.ikigai_world_profiles; v_role text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  v_role := case when (auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher' then 'teacher' else 'student' end;
  insert into public.ikigai_world_profiles(user_id,nickname,role,gender,avatar)
  values(auth.uid(),left(coalesce(nullif(trim(p_nickname),''),'Học viên'),24),v_role,case when p_gender='female' then 'female' else 'male' end,least(greatest(coalesce(p_avatar,0),0),1))
  on conflict(user_id) do update set nickname=excluded.nickname, role=v_role, gender=excluded.gender, avatar=excluded.avatar, updated_at=now();
  select * into r from public.ikigai_world_profiles where user_id=auth.uid(); return r;
end; $$;

create or replace function public.ikigai_award_quiz(p_xp integer,p_coins integer,p_correct integer,p_total integer,p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare r public.ikigai_world_profiles; v_xp integer; v_coins integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if (auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher' then raise exception 'Teacher accounts do not receive student rewards'; end if;
  if p_attempt_id is null or p_total < 1 or p_total > 100 or p_correct < 0 or p_correct > p_total then raise exception 'Invalid quiz result'; end if;
  insert into public.ikigai_world_profiles(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  insert into public.ikigai_world_quiz_attempts(id,user_id,correct_count,total_count,xp_awarded,coins_awarded)
  values(p_attempt_id,auth.uid(),p_correct,p_total,least(p_correct*10,200),least(p_correct*2,40))
  on conflict(id) do nothing;
  if not found then select xp,coins into v_xp,v_coins from public.ikigai_world_profiles where user_id=auth.uid(); return jsonb_build_object('xp',v_xp,'coins',v_coins,'duplicate',true); end if;
  update public.ikigai_world_profiles set xp=xp+least(p_correct*10,200), coins=coins+least(p_correct*2,40), updated_at=now() where user_id=auth.uid() returning * into r;
  return jsonb_build_object('xp',r.xp,'coins',r.coins,'duplicate',false);
end; $$;
revoke all on function public.ikigai_ensure_profile(text,text,integer) from public;
revoke all on function public.ikigai_award_quiz(integer,integer,integer,integer,uuid) from public;
grant execute on function public.ikigai_ensure_profile(text,text,integer) to authenticated;
grant execute on function public.ikigai_award_quiz(integer,integer,integer,integer,uuid) to authenticated;
