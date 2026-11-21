-- Run on the project database; all fixtures are rolled back.
BEGIN;
DO $$
DECLARE a uuid;b uuid;t uuid;v bigint;item record;s jsonb;
BEGIN
 SELECT user_id INTO a FROM public.ikigai_world_profiles WHERE role='student' ORDER BY user_id LIMIT 1;
 SELECT user_id INTO b FROM public.ikigai_world_profiles WHERE role='student' AND user_id<>a ORDER BY user_id LIMIT 1;
 SELECT user_id INTO t FROM public.ikigai_world_profiles WHERE role='teacher' LIMIT 1;
 IF a IS NULL OR b IS NULL THEN RAISE EXCEPTION 'Two student fixtures required';END IF;
 -- Isolate only within this rollback transaction; no historical data is changed.
 DELETE FROM ikigai_rewards_private.policy_attempts WHERE created_at>='2026-11-21 17:00+07';
 UPDATE ikigai_ranked.players SET xp_awarded=0 WHERE match_id IN
  (SELECT id FROM ikigai_ranked.matches WHERE settled_at>='2026-11-21 17:00+07');
 INSERT INTO ikigai_rewards_private.policy_attempts
 (user_id,source,lesson_key,attempt,correct,total,xp_awarded,coins_awarded,created_at) VALUES
 (a,'event_test','test',gen_random_uuid(),1,1,9999,0,'2026-11-21 16:59:59+07'),
 (a,'event_test','test',gen_random_uuid(),1,1,100,0,'2026-11-21 17:00:00+07'),
 (a,'event_test','test',gen_random_uuid(),1,1,100,0,'2026-11-22 10:00+07'),
 (b,'event_test','test',gen_random_uuid(),1,1,200,0,'2026-11-22 09:00+07'),
 (a,'event_test','test',gen_random_uuid(),1,1,50,0,'2026-11-24 23:59:59+07'),
 (b,'event_test','test',gen_random_uuid(),1,1,9999,0,'2026-11-25 00:00:00+07'),
 (b,'event_test','test',gen_random_uuid(),0,1,0,0,'2026-11-24 10:00+07');
 IF EXISTS(SELECT 1 FROM ikigai_event_private.board_at('2026-11-21 16:59:59+07')) THEN RAISE EXCEPTION 'Pre-event EXP leaked';END IF;
 SELECT event_xp INTO v FROM ikigai_event_private.board_at('2026-11-21 17:00+07') WHERE user_id=a;
 IF v IS DISTINCT FROM 100 THEN RAISE EXCEPTION 'Start boundary failed: %',v;END IF;
 SELECT * INTO item FROM ikigai_event_private.board_at('2026-11-23 00:00+07') WHERE rank=1;
 IF item.user_id IS DISTINCT FROM b OR item.event_xp<>200 THEN RAISE EXCEPTION 'Tie-break failed';END IF;
 SELECT * INTO item FROM ikigai_event_private.board_at('2026-11-26 00:00+07') WHERE rank=1;
 IF item.user_id IS DISTINCT FROM a OR item.event_xp<>250 THEN RAISE EXCEPTION 'End boundary failed';END IF;
 IF (SELECT count(*) FROM ikigai_event_private.board_at('2026-11-26 00:00+07'))<>2 THEN RAISE EXCEPTION 'Zero scores ranked';END IF;
 IF t IS NOT NULL THEN
  INSERT INTO ikigai_rewards_private.policy_attempts
  (user_id,source,lesson_key,attempt,correct,total,xp_awarded,coins_awarded,created_at)
  VALUES(t,'event_test','test',gen_random_uuid(),1,1,20000,0,'2026-11-22 00:00+07');
  IF EXISTS(SELECT 1 FROM ikigai_event_private.board_at('2026-11-26 00:00+07') WHERE user_id=t) THEN RAISE EXCEPTION 'Teacher ranked';END IF;
 END IF;
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 s:=public.ikigai_event_ho_ly_state();
 IF s->>'starts_at'<>'2026-11-21T17:00:00+07:00' OR s->>'ends_at'<>'2026-11-25T00:00:00+07:00' THEN RAISE EXCEPTION 'Wrong dates';END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 BEGIN
  PERFORM public.ikigai_event_ho_ly_state();
  RAISE EXCEPTION 'Unauthenticated caller allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF has_function_privilege('anon','public.ikigai_event_ho_ly_state()','EXECUTE') THEN RAISE EXCEPTION 'Anonymous grant';END IF;
 IF has_function_privilege('authenticated','ikigai_event_private.board_at(timestamptz)','EXECUTE') THEN RAISE EXCEPTION 'Client can override clock';END IF;
 IF NOT has_function_privilege('authenticated','public.ikigai_event_ho_ly_state()','EXECUTE') THEN RAISE EXCEPTION 'Member missing grant';END IF;
END $$;
ROLLBACK;
