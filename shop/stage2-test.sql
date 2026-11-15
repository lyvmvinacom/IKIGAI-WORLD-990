-- Run ONLY on a disposable test database with stage2.sql installed.
-- Supply an existing synthetic student UUID with a profile; never use a real student.
-- psql: \set test_user '...'
begin;
select set_config('ikigai.test_user', :'test_user', true);
do $$
begin
 if not exists(select 1 from public.ikigai_world_profiles where user_id=current_setting('ikigai.test_user')::uuid and role='student') then raise exception 'Synthetic student missing'; end if;
end $$;
update public.ikigai_world_profiles set coins=4000 where user_id=current_setting('ikigai.test_user')::uuid;
update ikigai_shop_private.settings set enabled=true;
update ikigai_shop_private.catalog set published=true where id in ('VIP001','VIP002','PET004');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('ikigai.test_user'),'role','authenticated','is_anonymous',false)::text,true);
set local role authenticated;
do $$
declare r jsonb;
begin
 r:=public.ikigai_shop_purchase('VIP001',3000);
 if r->>'status' <> 'purchased' or (r->>'coins')::int<>1000 then raise exception 'Purchase failed'; end if;
 r:=public.ikigai_shop_purchase('VIP001',3000);
 if r->>'status'<>'already_owned' or (r->>'coins')::int<>1000 then raise exception 'Duplicate charged'; end if;
 begin perform public.ikigai_shop_purchase('PET004',1500); raise exception 'Expected insufficient'; exception when raise_exception then if sqlerrm<>'INSUFFICIENT_COINS' then raise; end if; end;
 begin perform public.ikigai_shop_purchase('VIP002',1); raise exception 'Expected price check'; exception when raise_exception then if sqlerrm<>'PRICE_CHANGED' then raise; end if; end;
 begin perform public.ikigai_shop_equip('character','VIP002'); raise exception 'Expected ownership check'; exception when raise_exception then if sqlerrm<>'NOT_OWNED' then raise; end if; end;
 perform public.ikigai_shop_equip('character','VIP001');
 perform public.ikigai_shop_equip('character',null);
 r:=public.ikigai_shop_state();
 if (r->>'coins')::int<>1000 or jsonb_array_length(r->'inventory')<>1 then raise exception 'State mismatch'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from ikigai_shop_private.ledger where user_id=current_setting('ikigai.test_user')::uuid)<>1 then raise exception 'Ledger mismatch'; end if;
end $$;
rollback;
