-- Event rewards are never published. The legacy price constraint requires an
-- internal placeholder; the owned-reward response deliberately returns price 0.
-- No inventory, equipment, coins or EXP is awarded by this migration.
INSERT INTO ikigai_shop_private.catalog(id,kind,name,price,rarity,published) VALUES
 ('VIP025','character','Akatsuki · Hồ Ly Hộ Vệ',1000,'UR',false),
 ('PET011','pet','Cáo Linh Hỏa Vàng',1000,'UR',false),
 ('PET012','pet','Cáo Linh Hỏa Bạc',1000,'SSR',false),
 ('PET013','pet','Cáo Linh Hỏa Đồng',1000,'SR',false)
ON CONFLICT(id) DO NOTHING;

CREATE OR REPLACE FUNCTION ikigai_shop_private.state()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid();bal integer;active boolean;
BEGIN
 IF u IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false')='true' THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT enabled INTO active FROM ikigai_shop_private.settings WHERE id;
 SELECT coins INTO bal FROM public.ikigai_world_profiles WHERE user_id=u;
 IF bal IS NULL THEN RAISE EXCEPTION 'PROFILE_REQUIRED';END IF;
 RETURN jsonb_build_object(
  'profile',(SELECT jsonb_build_object('nickname',nickname,'gender',gender,'avatar',avatar,'xp',xp,'role',role)
    FROM public.ikigai_world_profiles WHERE user_id=u),
  'enabled',active,'coins',bal,
  'catalog',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM ikigai_shop_private.catalog c WHERE c.published AND active),'[]'::jsonb),
  'reward_catalog',coalesce((SELECT jsonb_agg(to_jsonb(c)||jsonb_build_object('event_only',true,'price',0) ORDER BY c.id)
    FROM ikigai_shop_private.catalog c JOIN ikigai_shop_private.inventory i ON i.item_id=c.id AND i.user_id=u
    WHERE c.id IN ('VIP025','PET011','PET012','PET013') AND NOT c.published),'[]'::jsonb),
  'inventory',coalesce((SELECT jsonb_agg(to_jsonb(i)-'user_id') FROM ikigai_shop_private.inventory i WHERE i.user_id=u),'[]'::jsonb),
  'equipment',coalesce((SELECT jsonb_agg(to_jsonb(e)-'user_id') FROM ikigai_shop_private.equipment e WHERE e.user_id=u),'[]'::jsonb)
 );
END $$;
-- Preserve the existing public invoker wrapper and private schema permissions.
REVOKE ALL ON FUNCTION ikigai_shop_private.state() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION ikigai_shop_private.state() TO authenticated;
NOTIFY pgrst,'reload schema';
