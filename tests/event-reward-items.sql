-- Rollback-only integration check against a registered student's real schema.
BEGIN;
DO $$
DECLARE u uuid;s jsonb;n integer;bal integer;xp_before integer;item text;
BEGIN
 SELECT p.user_id,p.coins,p.xp INTO u,bal,xp_before
 FROM public.ikigai_world_profiles p JOIN auth.users a ON a.id=p.user_id
 WHERE p.role='student' AND NOT coalesce(a.is_anonymous,false) LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'Student fixture required';END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 SELECT count(*) INTO n FROM ikigai_shop_private.catalog
 WHERE id IN ('VIP025','PET011','PET012','PET013') AND NOT published;
 IF n<>4 THEN RAISE EXCEPTION 'Missing or purchasable event item';END IF;
 FOREACH item IN ARRAY ARRAY['VIP025','PET011','PET012','PET013'] LOOP
  BEGIN
   PERFORM ikigai_shop_private.purchase(item,1000);
   RAISE EXCEPTION 'Event item was purchasable: %',item;
  EXCEPTION WHEN OTHERS THEN IF sqlerrm<>'ITEM_UNAVAILABLE' THEN RAISE;END IF;END;
 END LOOP;
 INSERT INTO ikigai_shop_private.inventory(user_id,item_id)
 SELECT u,id FROM ikigai_shop_private.catalog WHERE id IN ('VIP025','PET011','PET012','PET013')
 ON CONFLICT DO NOTHING;
 s:=public.ikigai_shop_state();
 IF jsonb_array_length(s->'reward_catalog')<>4 THEN RAISE EXCEPTION 'Owned rewards not visible';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(s->'catalog') c WHERE c->>'id' IN ('VIP025','PET011','PET012','PET013')) THEN RAISE EXCEPTION 'Reward leaked into shop';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(s->'reward_catalog') c WHERE (c->>'price')::int<>0 OR NOT (c->>'event_only')::boolean) THEN RAISE EXCEPTION 'Reward displayed as shop price';END IF;
 PERFORM public.ikigai_shop_equip('character','VIP025');
 FOREACH item IN ARRAY ARRAY['PET011','PET012','PET013'] LOOP
  PERFORM public.ikigai_shop_equip('pet',item);
  IF NOT EXISTS(SELECT 1 FROM public.ikigai_world_cosmetics WHERE user_id=u AND character_id='VIP025' AND pet_id=item) THEN RAISE EXCEPTION 'Sprite selection not synchronized';END IF;
 END LOOP;
 IF (SELECT coins<>bal OR xp<>xp_before FROM public.ikigai_world_profiles WHERE user_id=u) THEN RAISE EXCEPTION 'Wallet changed during equip';END IF;
END $$;
ROLLBACK;
