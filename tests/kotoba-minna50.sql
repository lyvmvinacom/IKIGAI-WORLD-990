-- Run inside one transaction; never retain test scores or rewards.
begin;
do $$
declare u uuid; base_coins int; run_id uuid; ids text[]; word_row ikigai_kotoba_private.words; result jsonb; seq int; lesson_id int; answer_mode text;
begin
 select user_id,coins into u,base_coins from public.ikigai_world_profiles where role='student' order by user_id limit 1;
 if u is null then raise exception 'Student profile required for rollback-only check';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'is_anonymous',false,'app_metadata',jsonb_build_object('role','student'))::text,true);
 foreach lesson_id in array array[26,50] loop
  select * into word_row from ikigai_kotoba_private.words where lesson=lesson_id order by id limit 1;
  foreach answer_mode in array array['jp','vi','listen'] loop
   result:=public.ikigai_kotoba_answer(gen_random_uuid(),1,word_row.id,answer_mode,case when answer_mode='vi' then word_row.jp else word_row.vi end);
   if not(result->>'correct')::boolean then raise exception 'Correct answer rejected for lesson %, mode %',lesson_id,answer_mode;end if;
  end loop;
  select array_agg(id order by id) into ids from ikigai_kotoba_private.words where lesson=lesson_id;
  run_id:=gen_random_uuid();perform public.ikigai_start_lesson_reward('kotoba',run_id,ids);seq:=0;
  foreach word_row.id in array ids loop
   seq:=seq+1;perform public.ikigai_kotoba_answer(run_id,seq,word_row.id,'jp','__test_wrong_answer__');
  end loop;
  result:=public.ikigai_completion_reward('kotoba',run_id);
  if (result->>'coins_awarded')::int<>50 then raise exception 'Expected 50 completion coins for lesson %: %',lesson_id,result;end if;
  result:=public.ikigai_completion_reward('kotoba',run_id);
  if (select coins from public.ikigai_world_profiles where user_id=u)<>base_coins+50 then raise exception 'Duplicate completion changed coins';end if;
  base_coins:=base_coins+50;
 end loop;
end $$;
rollback;
select 'passed: lessons 26 and 50, three answer modes, full-lesson registration, completion coins and duplicate protection; all test changes rolled back' as result;
