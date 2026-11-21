-- Shared reward rules for legacy classroom / room quizzes. No historical wallet recalculation.
CREATE OR REPLACE FUNCTION public.ikigai_room_quiz_finish(p_room text,p_group text,p_lesson integer,p_correct integer,p_total integer,p_attempt_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=ikigai_rewards_private.member(); receipt jsonb; k text;
BEGIN
 IF p_room IS NULL OR p_group IS NULL OR p_attempt_id IS NULL OR p_correct IS NULL OR p_total IS NULL OR p_total NOT BETWEEN 1 AND 20 OR p_correct NOT BETWEEN 0 AND p_total THEN RAISE EXCEPTION 'Invalid quiz'; END IF;
 IF p_room='class' THEN
  IF p_group NOT IN ('grammar','kaiwa') OR p_lesson IS NULL OR p_lesson NOT BETWEEN 1 AND 25 OR p_total>10 THEN RAISE EXCEPTION 'Invalid class lesson'; END IF;
  k:='class:'||p_group||':'||p_lesson;
 ELSIF p_room IN ('n5','n4','jft','arena') THEN
  IF p_lesson IS NOT NULL OR p_group NOT IN ('vocabulary','grammar','kanji','reading','mock','duel') OR (p_group NOT IN ('mock','duel') AND p_total>10) THEN RAISE EXCEPTION 'Invalid room quiz'; END IF;
  k:=p_room||':'||p_group;
 ELSE RAISE EXCEPTION 'Invalid quiz room'; END IF;
 receipt:=ikigai_rewards_private.settle_v2(u,'room_quiz',k,p_attempt_id,p_correct,p_total,least(p_correct*10,200),CASE WHEN p_group='mock' THEN 200 ELSE 50 END);
 RETURN receipt||jsonb_build_object('xp',receipt->'xp_total','coins',receipt->'coins_total');
END$$;
REVOKE ALL ON FUNCTION public.ikigai_room_quiz_finish(text,text,integer,integer,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ikigai_room_quiz_finish(text,text,integer,integer,integer,uuid) TO authenticated;

-- Old clients may read past receipts, but cannot create uncapped rewards.
CREATE OR REPLACE FUNCTION public.ikigai_award_quiz(p_xp integer,p_coins integer,p_correct integer,p_total integer,p_attempt_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=ikigai_rewards_private.member(); r public.ikigai_world_quiz_attempts;
BEGIN
 SELECT * INTO r FROM public.ikigai_world_quiz_attempts WHERE id=p_attempt_id AND user_id=u;
 IF NOT FOUND THEN RAISE EXCEPTION 'Phiên bản cũ. Vui lòng tải lại IKIGAI WORLD để lưu kết quả.'; END IF;
 RETURN ikigai_rewards_private.wallet(u,'quiz',p_attempt_id)||jsonb_build_object('xp',(select xp from public.ikigai_world_profiles where user_id=u),'coins',(select coins from public.ikigai_world_profiles where user_id=u),'duplicate',true);
END$$;
CREATE OR REPLACE FUNCTION public.ikigai_award_timed_quiz(p_correct integer,p_total integer,p_attempt_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RETURN public.ikigai_award_quiz(0,0,p_correct,p_total,p_attempt_id); END$$;

-- Individual assignment progress uses assigned learner for teachers, own account for students.
CREATE OR REPLACE FUNCTION public.ikigai_tasks_list()
 RETURNS TABLE(id uuid, room text, source text, lesson_key text, title text, due_at timestamp with time zone, student_id uuid, created_at timestamp with time zone, completed boolean, best_percent integer, attempt_count bigint, last_attempt timestamp with time zone, status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE teacher_role boolean:=ikigai_tasks_private.teacher();who uuid:=auth.uid();
BEGIN
 IF who IS NULL THEN RAISE insufficient_privilege USING message='Login required';END IF;
 RETURN QUERY
 SELECT a.id,a.room,a.source,a.lesson_key,a.title,a.due_at,a.student_id,a.created_at,
 COALESCE(h.passed,false),
 COALESCE(h.best,0),
 COALESCE(h.total_attempts,0),
 h.latest,
 CASE WHEN COALESCE(h.passed,false) THEN 'completed'
      WHEN a.due_at IS NOT NULL AND a.due_at<now() THEN 'overdue'
      WHEN COALESCE(h.total_attempts,0)>0 THEN 'in_progress'
      ELSE 'not_started' END
 FROM ikigai_tasks_private.assignments a
 LEFT JOIN LATERAL (
  SELECT bool_or(r.correct=r.total) AS passed,
  max(floor(r.correct*100.0/r.total)::integer) AS best,
  count(*) AS total_attempts,max(r.created_at) AS latest
  FROM ikigai_rewards_private.policy_attempts r
  WHERE r.user_id=CASE WHEN teacher_role THEN a.student_id ELSE who END AND r.source=a.source AND r.lesson_key=a.lesson_key
    AND r.created_at>=a.created_at
 ) h ON true
 WHERE a.active AND (teacher_role OR a.student_id IS NULL OR a.student_id=who)
 ORDER BY a.due_at NULLS LAST,a.created_at DESC;
END$function$;
NOTIFY pgrst,'reload schema';
