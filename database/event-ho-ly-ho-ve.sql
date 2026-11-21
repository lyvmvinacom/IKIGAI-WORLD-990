-- Read-only event projection. No wallet writes, reward resets or scheduled jobs.
CREATE SCHEMA IF NOT EXISTS ikigai_event_private;
REVOKE ALL ON SCHEMA ikigai_event_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA ikigai_event_private TO authenticated;

CREATE OR REPLACE FUNCTION ikigai_event_private.board_at(p_time timestamptz)
RETURNS TABLE(user_id uuid,nickname text,gender text,avatar integer,event_xp bigint,reached_at timestamptz,rank bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH earned AS (
  SELECT a.user_id,a.xp_awarded AS xp,a.created_at AS at
  FROM ikigai_rewards_private.policy_attempts a
  WHERE a.xp_awarded>0 AND a.created_at>='2026-11-21 17:00:00+07'::timestamptz
   AND a.created_at<'2026-11-25 00:00:00+07'::timestamptz AND a.created_at<=p_time
  UNION ALL
  SELECT p.player,p.xp_awarded,m.settled_at
  FROM ikigai_ranked.players p JOIN ikigai_ranked.matches m ON m.id=p.match_id
  WHERE p.xp_awarded>0 AND NOT m.void
   AND m.settled_at>='2026-11-21 17:00:00+07'::timestamptz
   AND m.settled_at<'2026-11-25 00:00:00+07'::timestamptz AND m.settled_at<=p_time
 ), totals AS (
  SELECT e.user_id,sum(e.xp)::bigint AS event_xp,max(e.at) AS reached_at
  FROM earned e GROUP BY e.user_id
 ), eligible AS (
  SELECT p.user_id,p.nickname,p.gender,p.avatar,t.event_xp,t.reached_at
  FROM totals t JOIN public.ikigai_world_profiles p ON p.user_id=t.user_id
  JOIN auth.users a ON a.id=p.user_id
  WHERE p.role='student' AND NOT coalesce(a.is_anonymous,false)
   AND coalesce(a.raw_app_meta_data->>'role','')<>'teacher'
   AND (a.banned_until IS NULL OR a.banned_until<=p_time)
 )
 SELECT e.*,row_number() OVER(ORDER BY e.event_xp DESC,e.reached_at,e.user_id) AS rank
 FROM eligible e ORDER BY rank
$$;
REVOKE ALL ON FUNCTION ikigai_event_private.board_at(timestamptz) FROM PUBLIC,anon,authenticated;

-- Definer is necessary to aggregate private, server-owned reward receipts.
-- Only the authenticated wrapper is exposed; caller must be a registered member.
CREATE OR REPLACE FUNCTION ikigai_event_private.state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE who uuid:=auth.uid();t timestamptz:=now();b jsonb;
BEGIN
 IF who IS NULL OR NOT EXISTS (
  SELECT 1 FROM auth.users a JOIN public.ikigai_world_profiles p ON p.user_id=a.id
  WHERE a.id=who AND NOT coalesce(a.is_anonymous,false)
   AND (a.banned_until IS NULL OR a.banned_until<=t)
 ) THEN RAISE insufficient_privilege USING message='Cần đăng nhập tài khoản IKIGAI.'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.rank),'[]'::jsonb) INTO b
 FROM ikigai_event_private.board_at(t) r;
 RETURN jsonb_build_object('id','ho-ly-ho-ve-20261122','server_time',t,
  'starts_at','2026-11-21T17:00:00+07:00','ends_at','2026-11-25T00:00:00+07:00',
  'status',CASE WHEN t<'2026-11-21 17:00+07'::timestamptz THEN 'upcoming'
   WHEN t<'2026-11-25 00:00+07'::timestamptz THEN 'active' ELSE 'ended' END,
  'leaderboard',b,'me',(SELECT x FROM jsonb_array_elements(b) x WHERE x->>'user_id'=who::text));
END $$;
REVOKE ALL ON FUNCTION ikigai_event_private.state() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ikigai_event_private.state() TO authenticated;
CREATE OR REPLACE FUNCTION public.ikigai_event_ho_ly_state()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$ SELECT ikigai_event_private.state() $$;
REVOKE ALL ON FUNCTION public.ikigai_event_ho_ly_state() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ikigai_event_ho_ly_state() TO authenticated;
NOTIFY pgrst,'reload schema';
