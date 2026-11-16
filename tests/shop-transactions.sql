-- Run in one transaction, set test.shop.user_id to an existing student, then ROLLBACK.
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.shop.user_id'),'role','authenticated','is_anonymous',false)::text,true);
do $$
declare s jsonb; before_coins int; before_xp int; r jsonb; n int;
begin
 s:=public.ikigai_shop_state(); before_coins:=(s->>'coins')::int; before_xp:=(s->'profile'->>'xp')::int;
 if jsonb_array_length(s->'catalog')<>34 then raise exception 'Expected 34 published items'; end if;
 begin perform public.ikigai_shop_equip('character','VIP013'); raise exception 'Unowned equip accepted'; exception when others then if sqlerrm<>'NOT_OWNED' then raise; end if; end;
 begin perform public.ikigai_shop_purchase('VIP013',1); raise exception 'Wrong price accepted'; exception when others then if sqlerrm<>'PRICE_CHANGED' then raise; end if; end;
 begin perform public.ikigai_shop_purchase('MISSING',1000); raise exception 'Unknown item accepted'; exception when others then if sqlerrm<>'ITEM_UNAVAILABLE' then raise; end if; end;
 r:=public.ikigai_shop_purchase('VIP013',1000);
 if r->>'status'<>'purchased' or (r->>'coins')::int<>before_coins-1000 then raise exception 'Purchase incorrect'; end if;
 r:=public.ikigai_shop_purchase('VIP013',1000);
 if r->>'status'<>'already_owned' or (r->>'coins')::int<>before_coins-1000 then raise exception 'Duplicate charged twice'; end if;
 perform public.ikigai_shop_equip('character','VIP013');
 if (select character_id from public.ikigai_world_cosmetics where user_id=auth.uid())<>'VIP013' then raise exception 'Appearance not synchronized'; end if;
 begin perform public.ikigai_shop_equip('pet','VIP013'); raise exception 'Wrong type accepted'; exception when others then if sqlerrm<>'NOT_OWNED' then raise; end if; end;
 r:=public.ikigai_shop_purchase('PET004',1500); perform public.ikigai_shop_equip('pet','PET004');
 s:=public.ikigai_shop_state();
 if (s->>'coins')::int<>before_coins-2500 or (s->'profile'->>'xp')::int<>before_xp then raise exception 'Wallet or XP changed incorrectly'; end if;
 if jsonb_array_length(s->'inventory')<>2 then raise exception 'Ownership incorrect'; end if;
 perform public.ikigai_shop_equip('pet',null); perform public.ikigai_shop_equip('character',null);
 if exists(select 1 from public.ikigai_world_cosmetics where user_id=auth.uid() and (character_id is not null or pet_id is not null)) then raise exception 'Unequip failed'; end if;
 begin perform count(*) from ikigai_shop_private.inventory; raise exception 'Inventory directly readable'; exception when insufficient_privilege then null; end;
 begin update public.ikigai_world_cosmetics set character_id='VIP001' where user_id=auth.uid(); raise exception 'Direct appearance write accepted'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.shop.user_id'),'role','authenticated','is_anonymous',true)::text,true);
 begin perform public.ikigai_shop_purchase('VIP001',3000); raise exception 'Guest purchase accepted'; exception when others then if sqlerrm<>'AUTH_REQUIRED' then raise; end if; end;
end $$;
reset role;
