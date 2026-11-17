-- Completion coins v1: 50 per full practice, 200 per timed examination.
-- Existing EXP formulas are deliberately unchanged. No historical auto-credit.
create schema if not exists ikigai_rewards_private;
revoke all on schema ikigai_rewards_private from public,anon,authenticated;
create table if not exists ikigai_rewards_private.policy(id boolean primary key default true check(id),live_from timestamptz not null default now());
insert into ikigai_rewards_private.policy(id) values(true) on conflict do nothing;
create table if not exists ikigai_rewards_private.ledger(
 user_id uuid not null references auth.users(id),source text not null,attempt uuid not null,
 amount integer not null check(amount in (50,200)),reason text not null,created_at timestamptz not null default now(),
 primary key(user_id,source,attempt));
create table if not exists ikigai_rewards_private.runs(
 user_id uuid not null references auth.users(id),source text not null,attempt uuid not null,
 ids text[] not null,answers jsonb,completed_at timestamptz,created_at timestamptz not null default now(),
 primary key(user_id,source,attempt));
create table if not exists ikigai_rewards_private.verb_keys(id text primary key,answers text[] not null);
create table if not exists ikigai_rewards_private.backfill_jft_173(
 attempt uuid primary key,user_id uuid not null references auth.users(id),before_coins integer not null,before_xp integer not null);
alter table ikigai_rewards_private.policy enable row level security;
alter table ikigai_rewards_private.ledger enable row level security;
alter table ikigai_rewards_private.runs enable row level security;
alter table ikigai_rewards_private.verb_keys enable row level security;
alter table ikigai_rewards_private.backfill_jft_173 enable row level security;
revoke all on all tables in schema ikigai_rewards_private from public,anon,authenticated;

create or replace function ikigai_rewards_private.member() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();begin
 if u is null or not exists(select 1 from auth.users a join public.ikigai_world_profiles p on p.user_id=a.id
  where a.id=u and p.role='student' and not coalesce(a.is_anonymous,false)
  and coalesce(a.raw_app_meta_data->>'role','')<>'teacher' and (a.banned_until is null or a.banned_until<=now()))
 then raise insufficient_privilege using message='Student account required';end if;return u;end$$;

create or replace function ikigai_rewards_private.wallet(u uuid,src text,run uuid,new_credit boolean default false)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('coins_total',p.coins,'xp_total',p.xp,'wallet_updated_at',p.updated_at,
 'coins_awarded',coalesce(l.amount,0),'new_credit',new_credit,'duplicate',not new_credit)
 from public.ikigai_world_profiles p left join ikigai_rewards_private.ledger l
 on l.user_id=p.user_id and l.source=src and l.attempt=run where p.user_id=u
$$;

create or replace function ikigai_rewards_private.credit(u uuid,src text,run uuid,amt integer,why text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare added boolean;begin
 if run is null or amt not in (50,200) then raise exception 'Invalid completion reward';end if;
 perform 1 from public.ikigai_world_profiles p join auth.users a on a.id=p.user_id
 where p.user_id=u and p.role='student' and not coalesce(a.is_anonymous,false)
 and coalesce(a.raw_app_meta_data->>'role','')<>'teacher' for update of p;
 if not found then raise insufficient_privilege using message='Student profile required';end if;
 insert into ikigai_rewards_private.ledger(user_id,source,attempt,amount,reason) values(u,src,run,amt,why) on conflict do nothing;
 added:=found;
 if added then update public.ikigai_world_profiles set coins=coins+amt,updated_at=now() where user_id=u;end if;
 return ikigai_rewards_private.wallet(u,src,run,added);
end$$;

-- Automatically reward saved, server-graded submissions, including older UI clients.
create or replace function ikigai_rewards_private.saved_completion() returns trigger language plpgsql security definer set search_path='' as $$
declare u uuid;run uuid;src text;amt integer:=200;completed timestamptz;begin
 if tg_table_schema='public' and tg_table_name='ikigai_jft_drill_results' then
  u:=new.user_id;run:=new.attempt_id;src:='jft_drill';amt:=case when new.test_id like 'excel-hyogen-%' then 200 else 50 end;completed:=new.created_at;
  if amt=50 and array_position(new.answers,-1) is not null then return new;end if;
 elsif tg_table_schema='ikigai_jft_scores' then u:=new.user_id;run:=new.attempt_id;src:='jft_exam';completed:=new.submitted_at;
 elsif tg_table_name='ikigai_grammar_results' then u:=new.user_id;run:=new.attempt_id;src:='grammar_exam';completed:=new.created_at;
 else
  if new.result is null or (tg_op='UPDATE' and old.result is not null) then return new;end if;
  u:=new.user_id;run:=new.id;src:='n4_exam';completed:=now();
 end if;
 if completed<(select live_from from ikigai_rewards_private.policy where id) then return new;end if;
 if exists(select 1 from public.ikigai_world_profiles p join auth.users a on a.id=p.user_id where p.user_id=u and p.role='student'
 and not coalesce(a.is_anonymous,false) and coalesce(a.raw_app_meta_data->>'role','')<>'teacher') then
  perform ikigai_rewards_private.credit(u,src,run,amt,'completion-v1');
 end if;return new;
end$$;
create trigger ikigai_completion_coins after insert on public.ikigai_jft_drill_results for each row execute function ikigai_rewards_private.saved_completion();
create trigger ikigai_completion_coins after insert on ikigai_jft_scores.results for each row execute function ikigai_rewards_private.saved_completion();
create trigger ikigai_completion_coins after insert on public.ikigai_grammar_results for each row execute function ikigai_rewards_private.saved_completion();
create trigger ikigai_completion_coins after insert or update of result on ikigai_n4_private.attempts for each row execute function ikigai_rewards_private.saved_completion();

create or replace function public.ikigai_completion_reward(p_source text,p_attempt uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=ikigai_rewards_private.member();amt integer:=50;completed timestamptz;ids text[];n integer;begin
 if p_attempt is null then raise exception 'Attempt required';end if;
 if exists(select 1 from ikigai_rewards_private.ledger where user_id=u and source=p_source and attempt=p_attempt) then
  return ikigai_rewards_private.wallet(u,p_source,p_attempt);end if;
 case p_source
 when 'jft_drill' then select created_at,case when test_id like 'excel-hyogen-%' then 200 else 50 end into completed,amt from public.ikigai_jft_drill_results where user_id=u and attempt_id=p_attempt and (test_id like 'excel-hyogen-%' or array_position(answers,-1) is null);
 when 'jft_exam' then select submitted_at into completed from ikigai_jft_scores.results where user_id=u and attempt_id=p_attempt;amt:=200;
 when 'grammar_exam' then select created_at into completed from public.ikigai_grammar_results where user_id=u and attempt_id=p_attempt;amt:=200;
 when 'n4_exam' then select (result->>'created_at')::timestamptz into completed from ikigai_n4_private.attempts where user_id=u and id=p_attempt and result is not null;amt:=200;
 when 'verb' then select completed_at into completed from ikigai_rewards_private.runs where user_id=u and source=p_source and attempt=p_attempt;
 when 'bunpou' then
  select r.ids into ids from ikigai_rewards_private.runs r where r.user_id=u and r.source=p_source and r.attempt=p_attempt;
  select count(*) into n from ikigai_ranked.bunpou_attempts where player=u and run=p_attempt and question=any(ids);
  if ids is not null and n=cardinality(ids) then completed:=now();end if;
 when 'kotoba' then
  select r.ids into ids from ikigai_rewards_private.runs r where r.user_id=u and r.source=p_source and r.attempt=p_attempt;
  select count(distinct word) into n from ikigai_kotoba_private.events where uid=u and run=p_attempt and word=any(ids);
  if ids is not null and n=cardinality(ids) then completed:=now();end if;
 else raise exception 'Unknown completion source';end case;
 if completed is null then raise exception 'Bài chưa hoàn thành hoặc chưa đồng bộ đủ câu trả lời';end if;
 if completed<(select live_from from ikigai_rewards_private.policy where id) then return ikigai_rewards_private.wallet(u,p_source,p_attempt);end if;
 return ikigai_rewards_private.credit(u,p_source,p_attempt,amt,'completion-v1');
end$$;

create or replace function public.ikigai_start_lesson_reward(p_source text,p_attempt uuid,p_ids text[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=ikigai_rewards_private.member();n integer;lesson_id integer;existing text[];begin
 if p_attempt is null or p_ids is null or cardinality(p_ids) not between 1 and 500
 or array_position(p_ids,null) is not null or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids)x) then raise exception 'Invalid lesson';end if;
 case p_source
 when 'verb' then
  if cardinality(p_ids)<>10 then raise exception 'Need 10 verbs';end if;
  select count(*) into n from ikigai_rewards_private.verb_keys where id=any(p_ids);
  if (select count(distinct split_part(x,':',2)) from unnest(p_ids)x)<>1 then raise exception 'Mixed conjugation forms';end if;
 when 'bunpou' then
  if cardinality(p_ids)<>30 then raise exception 'Need full 30-question lesson';end if;
  select count(*) into n from ikigai_ranked.bunpou_questions where id=any(p_ids);
 when 'kotoba' then
  select min(w.lesson),count(*) into lesson_id,n from ikigai_kotoba_private.words w where w.id=any(p_ids);
  if exists(select 1 from ikigai_kotoba_private.words w where w.id=any(p_ids) and w.lesson<>lesson_id)
   or (select count(*) from ikigai_kotoba_private.words w where w.lesson=lesson_id)<>cardinality(p_ids) then raise exception 'Need full vocabulary lesson';end if;
 else raise exception 'Unknown lesson';end case;
 if n<>cardinality(p_ids) then raise exception 'Unknown questions';end if;
 insert into ikigai_rewards_private.runs(user_id,source,attempt,ids) values(u,p_source,p_attempt,p_ids) on conflict do nothing;
 select r.ids into existing from ikigai_rewards_private.runs r where r.user_id=u and r.source=p_source and r.attempt=p_attempt;
 if existing is distinct from p_ids then raise exception 'Attempt reused with different questions';end if;
 return jsonb_build_object('registered',true);
end$$;

create or replace function public.ikigai_finish_verb_reward(p_attempt uuid,p_answers text[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=ikigai_rewards_private.member();r ikigai_rewards_private.runs;correct integer;begin
 select * into r from ikigai_rewards_private.runs where user_id=u and source='verb' and attempt=p_attempt for update;
 if r.attempt is null or cardinality(p_answers) is distinct from cardinality(r.ids) or array_position(p_answers,null) is not null
 or exists(select 1 from unnest(p_answers)x where length(x)>200) then raise exception 'Incomplete verb lesson';end if;
 if r.completed_at is null then
  update ikigai_rewards_private.runs set answers=to_jsonb(p_answers),completed_at=now() where user_id=u and source='verb' and attempt=p_attempt;
 end if;
 return public.ikigai_completion_reward('verb',p_attempt);
end$$;

-- Preserve the old API for existing clients, but issue flat practice completion coins.
create or replace function public.ikigai_award_quiz(p_xp integer,p_coins integer,p_correct integer,p_total integer,p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=ikigai_rewards_private.member();r public.ikigai_world_quiz_attempts;w jsonb;added boolean;begin
 if p_attempt_id is null or p_total is null or p_correct is null or p_total not between 1 and 100 or p_correct not between 0 and p_total then raise exception 'Invalid quiz result';end if;
 perform 1 from public.ikigai_world_profiles where user_id=u for update;
 insert into public.ikigai_world_quiz_attempts(id,user_id,correct_count,total_count,xp_awarded,coins_awarded)
 values(p_attempt_id,u,p_correct,p_total,least(p_correct*10,200),50) on conflict do nothing;added:=found;
 select * into r from public.ikigai_world_quiz_attempts where id=p_attempt_id;
 if r.user_id is distinct from u then raise insufficient_privilege using message='Attempt belongs to another student';end if;
 if added then
  update public.ikigai_world_profiles set xp=xp+r.xp_awarded,updated_at=now() where user_id=u;
  w:=ikigai_rewards_private.credit(u,'quiz',p_attempt_id,50,'completion-v1');
 else w:=ikigai_rewards_private.wallet(u,'quiz',p_attempt_id);end if;
 return w||jsonb_build_object('xp',(select xp from public.ikigai_world_profiles where user_id=u),'coins',(select coins from public.ikigai_world_profiles where user_id=u),'duplicate',not added);
end$$;

-- A timed generic test uses the same atomic receipt; a retry cannot add a second reward.
create or replace function public.ikigai_award_timed_quiz(p_correct integer,p_total integer,p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=ikigai_rewards_private.member();r public.ikigai_world_quiz_attempts;added boolean;w jsonb;begin
 if p_attempt_id is null or p_total is null or p_correct is null or p_total not between 1 and 100 or p_correct not between 0 and p_total then raise exception 'Invalid quiz result';end if;
 perform 1 from public.ikigai_world_profiles where user_id=u for update;
 insert into public.ikigai_world_quiz_attempts(id,user_id,correct_count,total_count,xp_awarded,coins_awarded)
 values(p_attempt_id,u,p_correct,p_total,least(p_correct*10,200),200) on conflict do nothing;added:=found;
 select * into r from public.ikigai_world_quiz_attempts where id=p_attempt_id;
 if r.user_id is distinct from u then raise insufficient_privilege using message='Attempt belongs to another student';end if;
 if added then
  update public.ikigai_world_profiles set xp=xp+r.xp_awarded,updated_at=now() where user_id=u;
  w:=ikigai_rewards_private.credit(u,'quiz',p_attempt_id,200,'timed-completion-v1');
 else w:=ikigai_rewards_private.wallet(u,'quiz',p_attempt_id);end if;
 return w||jsonb_build_object('xp',(select xp from public.ikigai_world_profiles where user_id=u),'coins',(select coins from public.ikigai_world_profiles where user_id=u),'duplicate',not added);
end$$;

revoke all on all functions in schema ikigai_rewards_private from public,anon,authenticated;
revoke all on function public.ikigai_completion_reward(text,uuid),public.ikigai_start_lesson_reward(text,uuid,text[]),public.ikigai_finish_verb_reward(uuid,text[]),public.ikigai_award_timed_quiz(integer,integer,uuid),public.ikigai_award_quiz(integer,integer,integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.ikigai_completion_reward(text,uuid),public.ikigai_start_lesson_reward(text,uuid,text[]),public.ikigai_finish_verb_reward(uuid,text[]),public.ikigai_award_timed_quiz(integer,integer,uuid),public.ikigai_award_quiz(integer,integer,integer,integer,uuid) to authenticated;

-- Award games atomically on their last saved answer, even if the result screen is closed.
create or replace function ikigai_rewards_private.game_completion() returns trigger language plpgsql security definer set search_path='' as $$
declare u uuid;src text;run_id uuid;ids text[];done integer;begin
 if tg_table_schema='ikigai_kotoba_private' then u:=new.uid;src:='kotoba';run_id:=new.run;
 else u:=new.player;src:='bunpou';run_id:=new.run;end if;
 select r.ids into ids from ikigai_rewards_private.runs r where r.user_id=u and r.source=src and r.attempt=run_id;
 if ids is null then return new;end if;
 if src='kotoba' then select count(distinct e.word) into done from ikigai_kotoba_private.events e where e.uid=u and e.run=run_id and e.word=any(ids);
 else select count(*) into done from ikigai_ranked.bunpou_attempts b where b.player=u and b.run=run_id and b.question=any(ids);end if;
 if done=cardinality(ids) then perform ikigai_rewards_private.credit(u,src,run_id,50,'completion-v1');end if;return new;
end$$;
revoke all on function ikigai_rewards_private.game_completion() from public,anon,authenticated;
create trigger ikigai_completion_coins after insert on ikigai_kotoba_private.events for each row execute function ikigai_rewards_private.game_completion();
create trigger ikigai_completion_coins after insert on ikigai_ranked.bunpou_attempts for each row execute function ikigai_rewards_private.game_completion();
