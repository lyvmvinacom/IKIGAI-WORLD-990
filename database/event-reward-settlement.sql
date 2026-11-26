-- Administrative settlement only. No client can invoke this function or edit receipts.
CREATE TABLE IF NOT EXISTS ikigai_event_private.reward_grants(
 event_id text NOT NULL,user_id uuid NOT NULL,rank integer NOT NULL CHECK(rank BETWEEN 1 AND 3),
 coins_awarded integer NOT NULL CHECK(coins_awarded IN(2000,3000,5000)),
 character_id text REFERENCES ikigai_shop_private.catalog(id),
 pet_id text NOT NULL REFERENCES ikigai_shop_private.catalog(id),
 event_xp bigint NOT NULL,coins_before integer NOT NULL,coins_after integer NOT NULL,
 xp_at_grant integer NOT NULL,granted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,user_id),UNIQUE(event_id,rank),
 CHECK(coins_after=coins_before+coins_awarded)
);
ALTER TABLE ikigai_event_private.reward_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ikigai_event_private.reward_grants FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION ikigai_event_private.grant_reward(p_event text,p_user uuid,p_rank integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE receipt ikigai_event_private.reward_grants;p public.ikigai_world_profiles;
 amount integer;skin text;pet text;points bigint;
BEGIN
 IF p_event IS DISTINCT FROM 'ho-ly-ho-ve-20261122' OR p_rank IS NULL OR p_rank NOT BETWEEN 1 AND 3
 OR now()<'2026-11-25 00:00+07'::timestamptz THEN RAISE EXCEPTION 'Invalid event settlement';END IF;
 SELECT * INTO p FROM public.ikigai_world_profiles WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND OR p.role<>'student' OR NOT EXISTS(SELECT 1 FROM auth.users a WHERE a.id=p_user
   AND NOT coalesce(a.is_anonymous,false) AND coalesce(a.raw_app_meta_data->>'role','')<>'teacher'
   AND (a.banned_until IS NULL OR a.banned_until<=now())) THEN RAISE EXCEPTION 'Student required';END IF;
 SELECT * INTO receipt FROM ikigai_event_private.reward_grants WHERE event_id=p_event AND user_id=p_user;
 IF FOUND THEN
  IF receipt.rank<>p_rank THEN RAISE EXCEPTION 'Conflicting event award';END IF;
  RETURN to_jsonb(receipt)||jsonb_build_object('already_granted',true);
 END IF;
 SELECT event_xp INTO points FROM ikigai_event_private.board_at(now()) WHERE user_id=p_user AND rank=p_rank;
 IF NOT FOUND THEN RAISE EXCEPTION 'Final event rank does not match';END IF;
 amount:=CASE p_rank WHEN 1 THEN 5000 WHEN 2 THEN 3000 ELSE 2000 END;
 skin:=CASE WHEN p_rank=1 THEN 'VIP025' END;
 pet:=CASE p_rank WHEN 1 THEN 'PET011' WHEN 2 THEN 'PET012' ELSE 'PET013' END;
 IF NOT EXISTS(SELECT 1 FROM ikigai_shop_private.catalog WHERE id=pet AND kind='pet' AND NOT published)
 OR (skin IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ikigai_shop_private.catalog WHERE id=skin AND kind='character' AND NOT published))
 THEN RAISE EXCEPTION 'Reward catalog not ready';END IF;
 INSERT INTO ikigai_event_private.reward_grants
 (event_id,user_id,rank,coins_awarded,character_id,pet_id,event_xp,coins_before,coins_after,xp_at_grant)
 VALUES(p_event,p_user,p_rank,amount,skin,pet,points,p.coins,p.coins+amount,p.xp) RETURNING * INTO receipt;
 INSERT INTO ikigai_shop_private.inventory(user_id,item_id)
 SELECT p_user,x FROM unnest(ARRAY[skin,pet]) x WHERE x IS NOT NULL ON CONFLICT DO NOTHING;
 UPDATE public.ikigai_world_profiles SET coins=coins+amount WHERE user_id=p_user;
 RETURN to_jsonb(receipt)||jsonb_build_object('already_granted',false);
END $$;
REVOKE ALL ON FUNCTION ikigai_event_private.grant_reward(text,uuid,integer) FROM PUBLIC,anon,authenticated;
