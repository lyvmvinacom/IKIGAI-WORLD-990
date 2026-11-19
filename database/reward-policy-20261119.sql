-- IKIGAI WORLD 2026-11 reward policy: SERVER ONLY. No historical wallet recalculation.
-- Only new completed attempts after this deployment count. Modes for the same lesson share a key.
CREATE TABLE IF NOT EXISTS ikigai_rewards_private.policy_attempts(
 user_id uuid NOT NULL REFERENCES auth.users(id), source text NOT NULL, lesson_key text NOT NULL,
 attempt uuid NOT NULL, correct integer NOT NULL, total integer NOT NULL,
 xp_awarded integer NOT NULL DEFAULT 0, coins_awarded integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id,source,attempt),
 CHECK (total > 0 AND correct BETWEEN 0 AND total),
 CHECK (xp_awarded>=0 AND coins_awarded>=0)
);
CREATE INDEX IF NOT EXISTS policy_attempts_user_lesson_idx ON ikigai_rewards_private.policy_attempts(user_id,source,lesson_key,created_at);
ALTER TABLE ikigai_rewards_private.policy_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ikigai_rewards_private.policy_attempts FROM PUBLIC,anon,authenticated;

-- Settlement takes only server-graded correct/total. Profile row lock serializes parallel devices.
CREATE OR REPLACE FUNCTION ikigai_rewards_private.settle_v2(
 u uuid, src text, lesson text, run uuid, correct_count integer, total_count integer,
 base_xp integer, base_coins integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE prev integer; factor numeric; awarded_xp integer:=0;awarded_coins integer:=0;
 rec ikigai_rewards_private.policy_attempts; was_new boolean:=false; p public.ikigai_world_profiles;
BEGIN
 IF u IS NULL OR src IS NULL OR length(src)>60 OR lesson IS NULL OR lesson='' OR length(lesson)>180 OR run IS NULL
 OR total_count IS NULL OR total_count<1 OR correct_count IS NULL OR correct_count<0 OR correct_count>total_count
 OR base_xp IS NULL OR base_xp NOT BETWEEN 0 AND 20000 OR base_coins IS NULL OR base_coins NOT BETWEEN 0 AND 10000
 THEN RAISE EXCEPTION 'Invalid reward settlement';END IF;
 SELECT p0.* INTO p FROM public.ikigai_world_profiles p0
 JOIN auth.users a ON a.id=p0.user_id
 WHERE p0.user_id=u AND p0.role='student' AND NOT coalesce(a.is_anonymous,false)
 AND coalesce(a.raw_app_meta_data->>'role','')<>'teacher' FOR UPDATE OF p0;
 IF NOT FOUND THEN RETURN jsonb_build_object('guest',true,'xp_awarded',0,'coins_awarded',0);END IF;
 SELECT * INTO rec FROM ikigai_rewards_private.policy_attempts WHERE user_id=u AND source=src AND attempt=run;
 IF FOUND THEN
  IF rec.lesson_key IS DISTINCT FROM lesson THEN RAISE EXCEPTION 'Attempt reused with another lesson';END IF;
  RETURN jsonb_build_object('xp_awarded',rec.xp_awarded,'coins_awarded',rec.coins_awarded,
   'already_recorded',true,'xp_total',p.xp,'coins_total',p.coins);
 END IF;
 SELECT count(*) INTO prev FROM ikigai_rewards_private.policy_attempts
 WHERE user_id=u AND source=src AND lesson_key=lesson;
 factor:=CASE WHEN correct_count*100<total_count*50 THEN 0
 WHEN correct_count*100<total_count*70 THEN 0.5
 WHEN correct_count*100<total_count*90 THEN 0.8 ELSE 1 END;
 IF prev<5 THEN
  awarded_xp:=floor(base_xp*factor)::integer;
  awarded_coins:=floor(base_coins*factor)::integer;
 END IF;
 INSERT INTO ikigai_rewards_private.policy_attempts
 (user_id,source,lesson_key,attempt,correct,total,xp_awarded,coins_awarded)
 VALUES(u,src,lesson,run,correct_count,total_count,awarded_xp,awarded_coins);
 IF awarded_xp>0 OR awarded_coins>0 THEN
  UPDATE public.ikigai_world_profiles
  SET xp=xp+awarded_xp,coins=coins+awarded_coins,updated_at=now()
  WHERE user_id=u RETURNING * INTO p;
 END IF;
 RETURN jsonb_build_object('xp_awarded',awarded_xp,'coins_awarded',awarded_coins,
 'already_recorded',false,'used',prev+1,'remaining',greatest(0,4-prev),
 'passed',factor>0,'xp_total',p.xp,'coins_total',p.coins);
END$$;
REVOKE ALL ON FUNCTION ikigai_rewards_private.settle_v2(uuid,text,text,uuid,integer,integer,integer,integer) FROM PUBLIC,anon,authenticated;

-- Existing auto-completion trigger is replaced: it no longer grants the unconditional 50 coins.
CREATE OR REPLACE FUNCTION ikigai_rewards_private.game_completion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid;src text;run_id uuid;ids text[];done integer;correct_count integer;
 lesson integer; key text; coins_base integer:=50; xp_base integer; receipt jsonb;
BEGIN
 IF tg_table_schema='ikigai_kotoba_private' THEN
   u:=new.uid;src:='kotoba';run_id:=new.run;
 ELSE u:=new.player;src:='bunpou';run_id:=new.run;END IF;
 SELECT r.ids INTO ids FROM ikigai_rewards_private.runs r
 WHERE r.user_id=u AND r.source=src AND r.attempt=run_id;
 IF ids IS NULL THEN RETURN new;END IF;
 IF src='kotoba' THEN
  SELECT count(distinct e.word),count(distinct e.word) FILTER (WHERE e.correct)
  INTO done,correct_count
  FROM ikigai_kotoba_private.events e WHERE e.uid=u AND e.run=run_id AND e.word=ANY(ids);
  SELECT min(w.lesson) INTO lesson FROM ikigai_kotoba_private.words w WHERE w.id=ANY(ids);
  key:='minna:'||lesson||':vocab';
  xp_base:=least(200,correct_count*2+CASE WHEN correct_count=cardinality(ids) THEN 50 ELSE 0 END);
 ELSE
  SELECT count(*),count(*) FILTER (WHERE b.correct) INTO done,correct_count
  FROM ikigai_ranked.bunpou_attempts b WHERE b.player=u AND b.run=run_id AND b.question=ANY(ids);
  SELECT min(q.lesson) INTO lesson FROM ikigai_ranked.bunpou_questions q WHERE q.id=ANY(ids);
  key:='minna:'||lesson||':grammar';
  xp_base:=least(200,correct_count*10);
 END IF;
 IF done=cardinality(ids) THEN
  receipt:=ikigai_rewards_private.settle_v2(u,src,key,run_id,correct_count,done,xp_base,coins_base);
 END IF;
 RETURN new;
END$$;
REVOKE ALL ON FUNCTION ikigai_rewards_private.game_completion() FROM PUBLIC,anon,authenticated;

-- New v2 receipt is authoritative; old claim endpoint cannot add coins again.
CREATE OR REPLACE FUNCTION public.ikigai_completion_reward(p_source text, p_attempt uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=ikigai_rewards_private.member();amt integer:=50;completed timestamptz;ids text[];n integer;awarded_xp integer;awarded_coins integer;begin
 if p_source IN ('kotoba','bunpou') then
  select a.xp_awarded,a.coins_awarded into awarded_xp,awarded_coins
  from ikigai_rewards_private.policy_attempts a where a.user_id=u and a.source=p_source and a.attempt=p_attempt;
  if found then
   return jsonb_build_object('xp_awarded',awarded_xp,'coins_awarded',awarded_coins,
    'xp_total',(select xp from public.ikigai_world_profiles where user_id=u),
    'coins_total',(select coins from public.ikigai_world_profiles where user_id=u),'duplicate',true);
  end if;
  return jsonb_build_object('pending',true,'xp_awarded',0,'coins_awarded',0);
 end if;

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
end$function$

REVOKE ALL ON FUNCTION public.ikigai_completion_reward(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ikigai_completion_reward(text,uuid) TO authenticated;

-- Server-side answers still validated; defer XP until full completion.
CREATE OR REPLACE FUNCTION public.ikigai_kotoba_answer(p_run uuid, p_seq integer, p_word text, p_mode text, p_answer text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare u uuid:=auth.uid(); d date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date; w ikigai_kotoba_private.words; r ikigai_kotoba_private.runs; ok boolean; earned int:=0; k text; amt int; total int; done int; daily int; newxp int; 
begin
if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or (auth.jwt()->'app_metadata'->>'role')='teacher' then raise exception 'Student login required'; end if;
if p_run is null or p_seq is null or p_seq<1 or p_seq>500 or p_mode is null or p_mode not in ('jp','vi','listen') then raise exception 'Invalid answer'; end if;
select * into w from ikigai_kotoba_private.words where id=p_word; if not found then raise exception 'Unknown word'; end if;
perform pg_advisory_xact_lock(hashtextextended(u::text,0));
select xp into newxp from public.ikigai_world_profiles where user_id=u and role='student'; if not found then raise exception 'Student profile required'; end if;
insert into ikigai_kotoba_private.runs(uid,run,lesson,day) values(u,p_run,w.lesson,d) on conflict do nothing;
select * into r from ikigai_kotoba_private.runs where uid=u and run=p_run;
if r.lesson<>w.lesson or r.day<>d then raise exception 'Invalid run'; end if;
if p_seq<=r.seq then return jsonb_build_object('xp',newxp,'earned',0,'duplicate',true); end if;
if p_seq<>r.seq+1 then raise exception 'Out of order'; end if;
ok:=coalesce(p_answer=case when p_mode='vi' then w.jp else w.vi end,false);
insert into ikigai_kotoba_private.events values(u,p_run,p_seq,w.id,ok);
update ikigai_kotoba_private.runs set seq=p_seq,streak=case when ok then streak+1 else 0 end,mistakes=mistakes+case when ok then 0 else 1 end where uid=u and run=p_run returning * into r;
-- v2: award on full completion only.
earned:=0;

select xp into newxp from public.ikigai_world_profiles where user_id=u;
return jsonb_build_object('xp',newxp,'earned',earned,'correct',ok);
end $function$

CREATE OR REPLACE FUNCTION public.ikigai_bunpou_answer(p_run uuid, p_question text, p_parts jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare who uuid:=auth.uid();canonical jsonb;ok boolean;award integer:=0;total_xp integer;already boolean:=false;
begin
 if who is null then raise exception 'Sign-in required';end if;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or coalesce(auth.jwt()->'app_metadata'->>'role','')='teacher'
  then return jsonb_build_object('guest',true,'earned',0);end if;
 if p_run is null or length(p_question)>120 or coalesce(pg_column_size(p_parts),0)>8000 then raise exception 'Invalid answer';end if;
 select parts into canonical from ikigai_ranked.bunpou_questions where id=p_question;
 if canonical is null then raise exception 'Unknown Bunpou question';end if;
 if not exists(select 1 from public.ikigai_world_profiles where user_id=who and role='student')
  then raise exception 'Student account required';end if;
 ok:=ikigai_ranked.bunpou_parts_correct(canonical,p_parts);award:=0; -- v2: settle on completion
 insert into ikigai_ranked.bunpou_attempts(player,run,question,correct,earned) values(who,p_run,p_question,ok,award)
 on conflict(player,run,question) do nothing;
 if not found then already:=true;award:=0;
 end if;
 select xp into total_xp from public.ikigai_world_profiles where user_id=who;
 return jsonb_build_object('correct',ok,'earned',award,'xp',total_xp,'duplicate',already);
end $function$

