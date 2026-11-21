CREATE OR REPLACE FUNCTION public.ikigai_ensure_profile(p_nickname text DEFAULT NULL::text, p_gender text DEFAULT NULL::text, p_avatar integer DEFAULT 0, p_hair integer DEFAULT 0, p_face integer DEFAULT 0)
 RETURNS ikigai_world_profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE r public.ikigai_world_profiles; v_role text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 SELECT CASE WHEN a.raw_app_meta_data->>'role'='teacher' THEN 'teacher' ELSE 'student' END INTO v_role FROM auth.users a WHERE a.id=auth.uid() AND NOT coalesce(a.is_anonymous,false) AND (a.banned_until IS NULL OR a.banned_until<=now());
 IF NOT FOUND THEN RAISE insufficient_privilege USING message='Registered account required'; END IF;
 INSERT INTO public.ikigai_world_profiles
 (user_id,nickname,role,gender,avatar,hair,face,character_locked)
 VALUES (auth.uid(),left(coalesce(nullif(trim(p_nickname),''),'Học viên'),24),
 v_role,CASE WHEN p_gender='female' THEN 'female' ELSE 'male' END,
 least(4,greatest(0,coalesce(p_avatar,0))),0,0,true)
 ON CONFLICT(user_id) DO UPDATE SET
 nickname=EXCLUDED.nickname,role=v_role,updated_at=now();
 SELECT * INTO r FROM public.ikigai_world_profiles WHERE user_id=auth.uid();
 RETURN r;
END $function$;
DROP POLICY IF EXISTS registered_users_only ON public.ikigai_assignments;
CREATE POLICY registered_users_only ON public.ikigai_assignments AS RESTRICTIVE FOR ALL TO authenticated USING (NOT coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)) WITH CHECK (NOT coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false));
DROP POLICY IF EXISTS registered_users_only ON public.ikigai_attempts;
CREATE POLICY registered_users_only ON public.ikigai_attempts AS RESTRICTIVE FOR ALL TO authenticated USING (NOT coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)) WITH CHECK (NOT coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false));
DROP POLICY IF EXISTS registered_users_only ON public.ikigai_grammar_results;
CREATE POLICY registered_users_only ON public.ikigai_grammar_results AS RESTRICTIVE FOR ALL TO authenticated USING (NOT coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)) WITH CHECK (NOT coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false));
DROP POLICY IF EXISTS registered_users_only ON public.ikigai_student_profiles;
CREATE POLICY registered_users_only ON public.ikigai_student_profiles AS RESTRICTIVE FOR ALL TO authenticated USING (NOT coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)) WITH CHECK (NOT coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false));
DROP POLICY IF EXISTS registered_users_only ON public.ikigai_world_profiles;
CREATE POLICY registered_users_only ON public.ikigai_world_profiles AS RESTRICTIVE FOR ALL TO authenticated USING (NOT coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)) WITH CHECK (NOT coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false));
DROP POLICY IF EXISTS registered_users_only ON public.ikigai_world_quiz_attempts;
CREATE POLICY registered_users_only ON public.ikigai_world_quiz_attempts AS RESTRICTIVE FOR ALL TO authenticated USING (NOT coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)) WITH CHECK (NOT coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false));
NOTIFY pgrst,'reload schema';