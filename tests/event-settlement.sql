BEGIN;
DO $$
DECLARE r record;first jsonb;again jsonb;before_coins integer;before_xp integer;after_coins integer;
BEGIN
 IF has_function_privilege('authenticated','ikigai_event_private.grant_reward(text,uuid,integer)','EXECUTE')
 OR has_function_privilege('anon','ikigai_event_private.grant_reward(text,uuid,integer)','EXECUTE')
 OR has_table_privilege('authenticated','ikigai_event_private.reward_grants','INSERT')
 THEN RAISE EXCEPTION 'Client can issue event rewards';END IF;
 FOR r IN SELECT * FROM ikigai_event_private.board_at(now()) WHERE rank<=3 ORDER BY user_id LOOP
  SELECT coins,xp INTO before_coins,before_xp FROM public.ikigai_world_profiles WHERE user_id=r.user_id;
  first:=ikigai_event_private.grant_reward('ho-ly-ho-ve-20261122',r.user_id,r.rank::int);
  again:=ikigai_event_private.grant_reward('ho-ly-ho-ve-20261122',r.user_id,r.rank::int);
  SELECT coins INTO after_coins FROM public.ikigai_world_profiles WHERE user_id=r.user_id;
  IF NOT (again->>'already_granted')::boolean THEN RAISE EXCEPTION 'Duplicate not detected';END IF;
  IF after_coins-before_coins<>(CASE WHEN (first->>'already_granted')::boolean THEN 0 ELSE (first->>'coins_awarded')::int END)
  OR (SELECT xp FROM public.ikigai_world_profiles WHERE user_id=r.user_id)<>before_xp THEN RAISE EXCEPTION 'Wallet/EXP mismatch';END IF;
  IF NOT EXISTS(SELECT 1 FROM ikigai_shop_private.inventory WHERE user_id=r.user_id AND item_id=first->>'pet_id')
  OR (r.rank=1 AND NOT EXISTS(SELECT 1 FROM ikigai_shop_private.inventory WHERE user_id=r.user_id AND item_id='VIP025'))
  THEN RAISE EXCEPTION 'Missing inventory reward';END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',r.user_id,'role','authenticated','is_anonymous',false)::text,true);
  PERFORM public.ikigai_shop_equip('pet',first->>'pet_id');
  IF r.rank=1 THEN PERFORM public.ikigai_shop_equip('character','VIP025');END IF;
  IF NOT EXISTS(SELECT 1 FROM public.ikigai_world_cosmetics WHERE user_id=r.user_id AND pet_id=first->>'pet_id')
  THEN RAISE EXCEPTION 'Reward cannot be equipped';END IF;
 END LOOP;
END $$;
ROLLBACK;
