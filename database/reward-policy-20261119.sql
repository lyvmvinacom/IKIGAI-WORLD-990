-- IKIGAI WORLD 2026-11 reward policy: SERVER ONLY. No historical wallet recalculation.
-- Only new completed attempts after this deployment count. Modes for the same lesson share a key.
CREATE TABLE IF NOT EXISTS ikigai_rewards_private.v2_activation(id boolean PRIMARY KEY DEFAULT true CHECK(id),live_at timestamptz NOT NULL DEFAULT now());
INSERT INTO ikigai_rewards_private.v2_activation(id) VALUES(true) ON CONFLICT DO NOTHING;
ALTER TABLE ikigai_rewards_private.v2_activation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ikigai_rewards_private.v2_activation FROM PUBLIC,anon,authenticated;
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
 lesson integer; key text; coins_base integer:=50; xp_base integer; receipt jsonb;run_created timestamptz;
BEGIN
 IF tg_table_schema='ikigai_kotoba_private' THEN
   u:=new.uid;src:='kotoba';run_id:=new.run;
 ELSE u:=new.player;src:='bunpou';run_id:=new.run;END IF;
 SELECT r.ids,r.created_at INTO ids,run_created FROM ikigai_rewards_private.runs r
 WHERE r.user_id=u AND r.source=src AND r.attempt=run_id;
 IF ids IS NULL OR run_created<(SELECT live_at FROM ikigai_rewards_private.v2_activation WHERE id) THEN RETURN new;END IF;
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
 if p_source IN ('kotoba','bunpou','jft_drill','jft_exam') then
  select a.xp_awarded,a.coins_awarded into awarded_xp,awarded_coins
  from ikigai_rewards_private.policy_attempts a where a.user_id=u and a.source=p_source and a.attempt=p_attempt;
  if found then
   return jsonb_build_object('xp_awarded',awarded_xp,'coins_awarded',awarded_coins,
    'xp_total',(select xp from public.ikigai_world_profiles where user_id=u),
    'coins_total',(select coins from public.ikigai_world_profiles where user_id=u),'duplicate',true);
  end if;
  if exists(select 1 from ikigai_rewards_private.ledger where user_id=u and source=p_source and attempt=p_attempt) then
   return ikigai_rewards_private.wallet(u,p_source,p_attempt);
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
end$function$;

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
end $function$;

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
end $function$;


-- JFT exam/drill policy: save score first, then settle in same transaction; remove old trigger coin path.
CREATE OR REPLACE FUNCTION ikigai_rewards_private.saved_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if src IN ('jft_drill','jft_exam') THEN return new; END IF;
 if completed<(select live_from from ikigai_rewards_private.policy where id) then return new;end if;
 if exists(select 1 from public.ikigai_world_profiles p join auth.users a on a.id=p.user_id where p.user_id=u and p.role='student'
 and not coalesce(a.is_anonymous,false) and coalesce(a.raw_app_meta_data->>'role','')<>'teacher') then
  perform ikigai_rewards_private.credit(u,src,run,amt,'completion-v1');
 end if;return new;
end$function$;
CREATE OR REPLACE FUNCTION public.ikigai_jft_drill_submit(p_attempt_id uuid, p_test_id text, p_ids text[], p_answers integer[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid();qs jsonb;q jsonb;i integer:=0;correct integer:=0;total integer:=0;earned integer:=0;prior integer;current_xp integer;saved public.ikigai_jft_drill_results;is_teacher boolean; receipt jsonb;
begin
 select u.raw_app_meta_data->>'role'='teacher' into is_teacher from auth.users u where u.id=uid and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now());
 if not found then raise insufficient_privilege using message='Cần đăng nhập tài khoản IKIGAI.';end if;
 if p_attempt_id is null or cardinality(p_ids) not between 1 and 500 or cardinality(p_ids) is distinct from cardinality(p_answers) or array_lower(p_ids,1)<>1 or array_lower(p_answers,1)<>1 then raise exception 'Bài luyện không hợp lệ';end if;
 select payload->'questions' into qs from public.ikigai_jft_drill_sets where id=p_test_id;
 if qs is null then
  if p_test_id!~'^excel-(kanji|vocabulary|hyogen)-[0-9]+-[0-9]+$' then raise exception 'Không tìm thấy đề';end if;
  select jsonb_agg(jsonb_build_object('id',r.id,'options',r.options,'accepted',jsonb_build_array(strpos('ABCD',r.correct)-1)) order by r.id collate "C") into qs
  from (select r.* from public.ikigai_room_questions r where r.room='jft'
   and r."group"=case split_part(p_test_id,'-',2) when 'hyogen' then 'grammar' else split_part(p_test_id,'-',2) end
   and r.lesson=split_part(p_test_id,'-',3)::int order by r.id collate "C" limit 20 offset greatest(0,(split_part(p_test_id,'-',4)::int-1)*20)) r;
 end if;
 if qs is null or jsonb_array_length(qs)<>cardinality(p_ids) then raise exception 'Bộ câu hỏi đã thay đổi, hãy mở lại đề';end if;
 for q in select value from jsonb_array_elements(qs) loop
  i:=i+1;
  if q->>'id' is distinct from p_ids[i] or p_answers[i] is null or p_answers[i]<-1 or p_answers[i]>=jsonb_array_length(q->'options') then raise exception 'Câu trả lời không hợp lệ';end if;
  if jsonb_array_length(q->'accepted')>0 then total:=total+1;if q->'accepted' @> to_jsonb(p_answers[i]) then correct:=correct+1;end if;end if;
 end loop;
 select xp into current_xp from public.ikigai_world_profiles where user_id=uid for update;
 if not found then raise exception 'Chưa có hồ sơ';end if;
 select * into saved from public.ikigai_jft_drill_results where attempt_id=p_attempt_id;
 if found then
  if saved.user_id<>uid or saved.test_id<>p_test_id then raise exception 'Mã lượt làm không hợp lệ';end if;
  return jsonb_build_object('correct',saved.correct_count,'total',saved.total_count,'xp_awarded',saved.xp_awarded,'xp_total',current_xp);
 end if;
 select coalesce(sum(xp_awarded),0) into prior from public.ikigai_jft_drill_results where user_id=uid and test_id=p_test_id;
 earned:=0;
 insert into public.ikigai_jft_drill_results values(p_attempt_id,uid,p_test_id,correct,total,earned,p_answers,now());
 if not coalesce(is_teacher,false) then
 receipt:=ikigai_rewards_private.settle_v2(uid,'jft_drill','jft:'||p_test_id,p_attempt_id,correct,total,least(correct*10,200),
 case when p_test_id like 'excel-hyogen-%' then 200 else 50 end);
 earned:=coalesce((receipt->>'xp_awarded')::integer,0);
 current_xp:=coalesce((receipt->>'xp_total')::integer,current_xp);
 update public.ikigai_jft_drill_results set xp_awarded=earned where attempt_id=p_attempt_id;
 end if;
 return jsonb_build_object('correct',correct,'total',total,'xp_awarded',earned,'xp_total',current_xp);
end;
$function$;
CREATE OR REPLACE FUNCTION ikigai_jft_scores.submit(p_account_id uuid, p_exam_id text, p_attempt_id uuid, p_answers integer[], p_class_proof text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  student uuid := ikigai_jft_scores.current_student();
  exam ikigai_jft_scores.exam_keys%rowtype;
  saved ikigai_jft_scores.results%rowtype;
  current_xp integer;
  already_earned integer;
  earned integer;
  correct integer;
  breakdown jsonb; receipt jsonb;
begin
  if student is null or student is distinct from p_account_id then
    raise insufficient_privilege using message = 'Student account required';
  end if;
  if p_attempt_id is null or array_ndims(p_answers) is distinct from 1
     or array_lower(p_answers, 1) is distinct from 1 or cardinality(p_answers) is distinct from 50 then
    raise invalid_parameter_value using message = 'Invalid JFT attempt';
  end if;

  select k.* into exam from ikigai_jft_scores.exam_keys as k where k.exam_id = p_exam_id;
  if not found then raise invalid_parameter_value using message = 'Unknown JFT exam'; end if;
  if p_class_proof is null or p_class_proof !~ '^[a-f0-9]{64}$'
     or pg_catalog.sha256(pg_catalog.convert_to(p_class_proof, 'UTF8')) <> exam.proof_hash then
    raise insufficient_privilege using message = 'Class exam access required';
  end if;
  if exists (
    select 1 from generate_series(1, 50) as q(n)
    where p_answers[q.n] < 0 or p_answers[q.n] >= exam.option_counts[q.n]
  ) then raise invalid_parameter_value using message = 'Invalid JFT answer'; end if;

  -- Serialize XP changes for one player, including concurrent retries and other game awards.
  insert into public.ikigai_world_profiles (user_id) values (student) on conflict (user_id) do nothing;
  select p.xp into current_xp from public.ikigai_world_profiles as p
    where p.user_id = student for update;

  select r.* into saved from ikigai_jft_scores.results as r
    where r.user_id = student and r.attempt_id = p_attempt_id;
  if found then
    if saved.exam_id <> p_exam_id then raise invalid_parameter_value using message = 'Attempt exam mismatch'; end if;
    return (to_jsonb(saved) - 'user_id') || jsonb_build_object('xp_total', current_xp);
  end if;

  select sum(b.correct)::integer,
         jsonb_agg(jsonb_build_object('correct', b.correct, 'total', b.total) order by b.section)
  into correct, breakdown
  from (
    select exam.sections[q.n] as section, count(*) as total,
           count(*) filter (where p_answers[q.n] = exam.answers[q.n]) as correct
    from generate_series(1, 50) as q(n)
    group by exam.sections[q.n]
  ) as b;

  select coalesce(sum(r.xp_awarded), 0)::integer into already_earned
  from ikigai_jft_scores.results as r
  where r.user_id = student and r.exam_id = p_exam_id;
  earned := 0;

  insert into ikigai_jft_scores.results
    (user_id, attempt_id, exam_id, correct_count, score, sections, xp_awarded)
  values
    (student, p_attempt_id, p_exam_id, correct, round(10 + 240.0 * correct / 50)::integer, breakdown, earned)
  returning * into saved;

  receipt:=ikigai_rewards_private.settle_v2(student,'jft_exam','exam:'||p_exam_id,p_attempt_id,correct,50,least(correct*10,200),200);
 earned:=coalesce((receipt->>'xp_awarded')::integer,0);
 current_xp:=coalesce((receipt->>'xp_total')::integer,current_xp);
 update ikigai_jft_scores.results set xp_awarded=earned where user_id=student and attempt_id=p_attempt_id returning * into saved;
 return (to_jsonb(saved) - 'user_id') || jsonb_build_object('xp_total', current_xp);
end;
$function$;
