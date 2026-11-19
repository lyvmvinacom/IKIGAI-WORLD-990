-- IKIGAI WORLD mandatory missions: no EXP, no coins, 100% verified mastery.
-- Depends on ikigai_rewards_private.policy_attempts from reward-policy-20261119.sql.
CREATE SCHEMA IF NOT EXISTS ikigai_tasks_private;
REVOKE ALL ON SCHEMA ikigai_tasks_private FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS ikigai_tasks_private.assignments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 room text NOT NULL CHECK(room IN ('class','n5','n4','jft')),
 source text NOT NULL CHECK(source IN ('kotoba','bunpou','verb','jft_drill','jft_exam','n4_exam','grammar_exam')),
 lesson_key text NOT NULL CHECK(length(lesson_key) BETWEEN 3 AND 180),
 title text NOT NULL CHECK(length(title) BETWEEN 3 AND 120),
 student_id uuid REFERENCES auth.users(id),
 due_at timestamptz,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS ikigai_tasks_student_idx ON ikigai_tasks_private.assignments(student_id,active,due_at);
CREATE INDEX IF NOT EXISTS ikigai_tasks_match_idx ON ikigai_tasks_private.assignments(source,lesson_key,created_at);
ALTER TABLE ikigai_tasks_private.assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA ikigai_tasks_private FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION ikigai_tasks_private.teacher() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid()
 AND NOT coalesce(u.is_anonymous,false) AND u.raw_app_meta_data->>'role'='teacher'
 AND (u.banned_until IS NULL OR u.banned_until<=now()));
$$;

CREATE OR REPLACE FUNCTION public.ikigai_tasks_save(
 p_id uuid,p_room text,p_source text,p_lesson_key text,p_title text,p_due_at timestamptz,p_student_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE output_id uuid;
BEGIN
 IF NOT ikigai_tasks_private.teacher() THEN RAISE insufficient_privilege USING message='Teacher required';END IF;
 IF p_room NOT IN ('class','n5','n4','jft')
 OR p_source NOT IN ('kotoba','bunpou','verb','jft_drill','jft_exam','n4_exam','grammar_exam')
 OR length(trim(coalesce(p_title,''))) NOT BETWEEN 3 AND 120
 OR length(trim(coalesce(p_lesson_key,''))) NOT BETWEEN 3 AND 180
 THEN RAISE EXCEPTION 'Invalid task';END IF;
 -- Explicit combinations keep teacher from accidentally targeting unrelated rooms.
 IF (p_room='jft' AND p_source NOT IN ('jft_drill','jft_exam'))
 OR (p_room='n4' AND p_source NOT IN ('n4_exam','grammar_exam','verb'))
 OR (p_room='n5' AND p_source NOT IN ('grammar_exam','verb','bunpou','kotoba'))
 OR (p_room='class' AND p_source NOT IN ('kotoba','bunpou','verb','grammar_exam'))
 THEN RAISE EXCEPTION 'Source does not belong to room';END IF;
 IF (p_source='kotoba' AND p_lesson_key !~ '^minna:[0-9]+:vocab$')
 OR (p_source='bunpou' AND p_lesson_key !~ '^minna:[0-9]+:grammar$')
 OR (p_source='verb' AND p_lesson_key !~ '^verb:(N5|N4):[a-zA-Z]+$')
 OR (p_source='jft_drill' AND p_lesson_key !~ '^jft:[a-zA-Z0-9_.:-]+$')
 OR (p_source='jft_exam' AND p_lesson_key !~ '^exam:[a-zA-Z0-9_.:-]+$')
 OR (p_source='n4_exam' AND p_lesson_key !~ '^n4:[a-zA-Z0-9_.:-]+$')
 OR (p_source='grammar_exam' AND p_lesson_key !~ '^grammar:[a-zA-Z0-9_.:-]+$')
 THEN RAISE EXCEPTION 'Invalid lesson key for source'; END IF;
 IF p_student_id IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM public.ikigai_world_profiles p
 JOIN auth.users u ON u.id=p.user_id
 WHERE p.user_id=p_student_id AND p.role='student' AND NOT coalesce(u.is_anonymous,false))
 THEN RAISE EXCEPTION 'Unknown student account';END IF;
 IF p_id IS NULL THEN
  INSERT INTO ikigai_tasks_private.assignments(room,source,lesson_key,title,student_id,due_at,created_by)
  VALUES(p_room,p_source,p_lesson_key,trim(p_title),p_student_id,p_due_at,auth.uid()) RETURNING id INTO output_id;
 ELSE
  UPDATE ikigai_tasks_private.assignments SET room=p_room,source=p_source,
  lesson_key=p_lesson_key,title=trim(p_title),student_id=p_student_id,due_at=p_due_at
  WHERE id=p_id RETURNING id INTO output_id;
  IF output_id IS NULL THEN RAISE EXCEPTION 'Task not found';END IF;
 END IF;
 RETURN output_id;
END$$;

CREATE OR REPLACE FUNCTION public.ikigai_tasks_archive(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT ikigai_tasks_private.teacher() THEN RAISE insufficient_privilege USING message='Teacher required';END IF;
 UPDATE ikigai_tasks_private.assignments SET active=false WHERE id=p_id;
 RETURN found;
END$$;

-- A student sees only own assignments; teacher sees authored tasks. Status based on server-verified receipts.
CREATE OR REPLACE FUNCTION public.ikigai_tasks_list() RETURNS TABLE(
 id uuid,room text,source text,lesson_key text,title text,due_at timestamptz,
 student_id uuid,created_at timestamptz,completed boolean,best_percent integer,
 attempt_count bigint,last_attempt timestamptz,status text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
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
  WHERE r.user_id=who AND r.source=a.source AND r.lesson_key=a.lesson_key
    AND r.created_at>=a.created_at
 ) h ON NOT teacher_role
 WHERE a.active AND (teacher_role OR a.student_id IS NULL OR a.student_id=who)
 ORDER BY a.due_at NULLS LAST,a.created_at DESC;
END$$;

CREATE OR REPLACE FUNCTION public.ikigai_tasks_students() RETURNS TABLE(user_id uuid,nickname text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT ikigai_tasks_private.teacher() THEN RAISE insufficient_privilege USING message='Teacher required';END IF;
 RETURN QUERY
 SELECT p.user_id,coalesce(nullif(p.nickname,''),'Học viên')::text
 FROM public.ikigai_world_profiles p JOIN auth.users u ON u.id=p.user_id
 WHERE p.role='student' AND NOT coalesce(u.is_anonymous,false)
 ORDER BY lower(p.nickname),p.user_id;
END$$;

CREATE OR REPLACE FUNCTION public.ikigai_tasks_report(p_id uuid)
RETURNS TABLE(user_id uuid,nickname text,completed boolean,best_percent integer,attempt_count bigint,last_attempt timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a ikigai_tasks_private.assignments;
BEGIN
 IF NOT ikigai_tasks_private.teacher() THEN RAISE insufficient_privilege USING message='Teacher required';END IF;
 SELECT * INTO a FROM ikigai_tasks_private.assignments WHERE id=p_id AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Task not found';END IF;
 RETURN QUERY
 SELECT p.user_id,coalesce(nullif(p.nickname,''),'Học viên')::text,
 COALESCE(h.passed,false),COALESCE(h.best,0),COALESCE(h.attempts,0),h.latest
 FROM public.ikigai_world_profiles p JOIN auth.users u ON u.id=p.user_id
 LEFT JOIN LATERAL (
 SELECT bool_or(r.correct=r.total) passed,
 max(floor(r.correct*100.0/r.total)::integer) best,
 count(*) attempts,max(r.created_at) latest
 FROM ikigai_rewards_private.policy_attempts r
 WHERE r.user_id=p.user_id AND r.source=a.source AND r.lesson_key=a.lesson_key
 AND r.created_at>=a.created_at
 ) h ON true
 WHERE p.role='student' AND NOT coalesce(u.is_anonymous,false)
 AND (a.student_id IS NULL OR a.student_id=p.user_id)
 ORDER BY COALESCE(h.passed,false),lower(p.nickname);
END$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ikigai_tasks_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ikigai_tasks_save(uuid,text,text,text,text,timestamptz,uuid),
 public.ikigai_tasks_archive(uuid),public.ikigai_tasks_list(),public.ikigai_tasks_students(),
 public.ikigai_tasks_report(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ikigai_tasks_save(uuid,text,text,text,text,timestamptz,uuid),
 public.ikigai_tasks_archive(uuid),public.ikigai_tasks_list(),public.ikigai_tasks_students(),
 public.ikigai_tasks_report(uuid) TO authenticated;
