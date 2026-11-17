-- Run as the database owner. Every test write is rolled back.
begin;
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select p.user_id::text from public.ikigai_world_profiles p
         join auth.users u on u.id=p.user_id
         where p.role='student' and not coalesce(u.is_anonymous,false)
         and coalesce(u.raw_app_meta_data->>'role','')<>'teacher' limit 1),
  'role','authenticated','app_metadata',jsonb_build_object('role','student'))::text,true);
set local role authenticated;
do $test$
declare a jsonb:=(select jsonb_agg('A'::text) from generate_series(1,55));
        ids jsonb:=(select jsonb_agg('G30_31_TEST_'||n::text) from generate_series(1,55) n);
        attempt uuid:=gen_random_uuid();
begin
 if auth.uid() is null then raise exception 'A registered student is required for this test'; end if;
 insert into public.ikigai_grammar_results
 (id,user_id,test_id,correct_count,total_count,score_percent,duration_seconds,answers,question_ids,bank_version,attempt_id,created_at)
 overriding system value values
 (-260031,auth.uid(),'grammar-15',55,55,100,60,a,ids,'source-2026-11-17-n4-approved659',attempt,'2000-01-01');
 if not exists(select 1 from public.ikigai_grammar_results where attempt_id=attempt and total_count=55 and score_percent=100) then
   raise exception 'New grammar test result was not saved under student RLS';
 end if;
 begin
  insert into public.ikigai_grammar_results
  (id,user_id,test_id,correct_count,total_count,score_percent,duration_seconds,answers,question_ids,bank_version,created_at)
  overriding system value values
  (-260032,auth.uid(),'grammar-15',55,55,99,60,a,ids,'test','2000-01-01');
  raise exception 'Invalid score was accepted';
 exception when check_violation then null;
 end;
 begin
  insert into public.ikigai_grammar_results
  (id,user_id,test_id,correct_count,total_count,score_percent,duration_seconds,answers,question_ids,bank_version,created_at)
  overriding system value values
  (-260033,auth.uid(),'grammar-25',55,55,100,60,a,ids,'test','2000-01-01');
  raise exception 'Out of range test ID was accepted';
 exception when check_violation then null;
 end;
end $test$;
rollback;
