-- Authorized on 2026-11-17: ONLY the 173 JFT practice receipts in the audit.
-- These bounds were verified against 173 records / 8 students / 22,330 EXP.
-- Newer attempts are deliberately not selected by this historical batch.
begin;
do $$
declare r record;begin
 if (select count(*) from public.ikigai_jft_drill_results
  where created_at between '2026-11-10T00:00:00Z' and '2026-11-16T14:18:00.704859Z')<>173
 then raise exception 'Historical JFT audit no longer matches';end if;
 perform p.user_id from public.ikigai_world_profiles p where p.user_id in
  (select user_id from public.ikigai_jft_drill_results where created_at between '2026-11-10T00:00:00Z' and '2026-11-16T14:18:00.704859Z')
 order by p.user_id for update;
 insert into ikigai_rewards_private.backfill_jft_173
 select a.attempt_id,a.user_id,p.coins,p.xp from public.ikigai_jft_drill_results a
 join public.ikigai_world_profiles p on p.user_id=a.user_id
 where a.created_at between '2026-11-10T00:00:00Z' and '2026-11-16T14:18:00.704859Z'
 on conflict do nothing;
 for r in select * from ikigai_rewards_private.backfill_jft_173 order by user_id,attempt loop
  perform ikigai_rewards_private.credit(r.user_id,'jft_drill',r.attempt,50,'backfill-jft-173');
 end loop;
 if (select sum(l.amount) from ikigai_rewards_private.ledger l join ikigai_rewards_private.backfill_jft_173 b
  on b.user_id=l.user_id and b.attempt=l.attempt where l.source='jft_drill')<>8650
 then raise exception 'Historical reward total mismatch';end if;
end$$;
commit;
