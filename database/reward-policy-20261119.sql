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
CREATE OR REPLACE FUNCTION public.ikigai_completion_reward(p_source text,p_attempt uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=ikigai_rewards_private.member();rec ikigai_rewards_private.policy_attempts; p public.ikigai_world_profiles;
BEGIN
 SELECT * INTO rec FROM ikigai_rewards_private.policy_attempts
 WHERE user_id=u AND source=p_source AND attempt=p_attempt;
 IF NOT FOUND THEN
  RETURN jsonb_build_object('pending',true,'coins_awarded',0,'xp_awarded',0);
 END IF;
 SELECT * INTO p FROM public.ikigai_world_profiles WHERE user_id=u;
 RETURN jsonb_build_object('coins_awarded',rec.coins_awarded,'xp_awarded',rec.xp_awarded,
 'coins_total',p.coins,'xp_total',p.xp,'duplicate',true);
END$$;
REVOKE ALL ON FUNCTION public.ikigai_completion_reward(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ikigai_completion_reward(text,uuid) TO authenticated;
