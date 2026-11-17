-- Integration checks run inside one rollback-only transaction against seeded data.
begin;
do $$
declare u uuid;other_user uuid;baseline integer;before_xp integer;run uuid;r jsonb;ids text[];word text;seq integer;selected_test text;payload jsonb;
 q public.ikigai_jft_drill_results;j ikigai_jft_scores.results;g public.ikigai_grammar_results;a ikigai_n4_private.attempts;
begin
 select user_id into u from ikigai_rewards_private.backfill_jft_173 order by user_id limit 1;
 select user_id into other_user from ikigai_rewards_private.backfill_jft_173 where user_id<>u limit 1;
 if u is null then raise exception 'Seeded student required';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'is_anonymous',false,'app_metadata',jsonb_build_object('role','student'))::text,true);
 select coins,xp into baseline,before_xp from public.ikigai_world_profiles where user_id=u;
 run:=gen_random_uuid();r:=public.ikigai_award_quiz(0,0,0,10,run);
 if (r->>'coins_total')::int<>baseline+50 then raise exception 'Practice completion must give 50 even when all answers are wrong';end if;
 r:=public.ikigai_award_quiz(0,0,0,10,run);
 if (r->>'coins_total')::int<>baseline+50 or not (r->>'duplicate')::boolean then raise exception 'Practice replay credited twice';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_user)::text,true);
 begin perform public.ikigai_award_quiz(0,0,0,10,run);raise exception 'Cross-user receipt accepted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'is_anonymous',false,'app_metadata',jsonb_build_object('role','student'))::text,true);
 run:=gen_random_uuid();r:=public.ikigai_award_timed_quiz(0,20,run);
 if (r->>'coins_total')::int<>baseline+250 then raise exception 'Exam completion must give 200';end if;
 r:=public.ikigai_award_timed_quiz(0,20,run);
 if (r->>'coins_total')::int<>baseline+250 then raise exception 'Exam replay credited twice';end if;
 if (select xp from public.ikigai_world_profiles where user_id=u)<>before_xp then raise exception 'Completion coins changed EXP';end if;
 -- Verbs: incomplete runs cannot claim; finishing all ten grants once.
 select array_agg(id order by id) into ids from(select id from ikigai_rewards_private.verb_keys where id like '%:te' order by id limit 10)x;
 run:=gen_random_uuid();perform public.ikigai_start_lesson_reward('verb',run,ids);
 begin perform public.ikigai_completion_reward('verb',run);raise exception 'Incomplete run paid';exception when raise_exception then if sqlerrm='Incomplete run paid' then raise;end if;end;
 r:=public.ikigai_finish_verb_reward(run,array_fill('__wrong__'::text,array[10]));
 if (r->>'coins_total')::int<>baseline+300 then raise exception 'Verb completion missing';end if;
 r:=public.ikigai_finish_verb_reward(run,array_fill('__wrong__'::text,array[10]));
 if (r->>'coins_total')::int<>baseline+300 then raise exception 'Verb retry paid twice';end if;
 -- Bunpou: the server requires all registered question receipts.
 select array_agg(id order by id) into ids from(select id from ikigai_ranked.bunpou_questions order by id limit 30)x;
 run:=gen_random_uuid();perform public.ikigai_start_lesson_reward('bunpou',run,ids);
 foreach word in array ids loop perform public.ikigai_bunpou_answer(run,word,null);end loop;
 r:=public.ikigai_completion_reward('bunpou',run);
 if (r->>'coins_total')::int<>baseline+350 then raise exception 'Bunpou completion missing';end if;
 -- Kotoba: repeats of a few words cannot stand in for a whole lesson.
 select array_agg(id order by id) into ids from ikigai_kotoba_private.words where lesson=1;
 run:=gen_random_uuid();perform public.ikigai_start_lesson_reward('kotoba',run,ids);seq:=0;
 foreach word in array ids loop seq:=seq+1;perform public.ikigai_kotoba_answer(run,seq,word,'jp','__wrong__');end loop;
 r:=public.ikigai_completion_reward('kotoba',run);
 if (r->>'coins_total')::int<>baseline+400 then raise exception 'Kotoba completion missing';end if;
 -- Automatic award triggers are atomic with the saved result.
 select * into q from public.ikigai_jft_drill_results where test_id like 'kanji-%' limit 1;
 q.attempt_id:=gen_random_uuid();q.user_id:=u;q.created_at:=now();q.answers:=array_fill(-1,array[q.total_count]);
 insert into public.ikigai_jft_drill_results select(q).*;
 if (select coins from public.ikigai_world_profiles where user_id=u)<>baseline+400 then raise exception 'Incomplete JFT practice paid';end if;
 q.attempt_id:=gen_random_uuid();q.answers:=array_fill(0,array[q.total_count]);
 insert into public.ikigai_jft_drill_results select(q).*;
 r:=public.ikigai_completion_reward('jft_drill',q.attempt_id);
 if (r->>'coins_total')::int<>baseline+450 then raise exception 'JFT practice trigger missing or paid twice';end if;
 select ds.id,ds.payload into selected_test,payload from public.ikigai_jft_drill_sets ds where ds.id like 'kanji-%' limit 1;
 select array_agg(x->>'id' order by ord) into ids from jsonb_array_elements(payload->'questions') with ordinality as qs(x,ord);
 run:=gen_random_uuid();r:=public.ikigai_jft_drill_submit(run,selected_test,ids,array_fill(0,array[cardinality(ids)]));
 perform public.ikigai_jft_drill_submit(run,selected_test,ids,array_fill(0,array[cardinality(ids)]));
 if (select coins from public.ikigai_world_profiles where user_id=u)<>baseline+500 then raise exception 'Server-graded JFT submit/retry reward incorrect';end if;
 select * into j from ikigai_jft_scores.results limit 1;j.user_id:=u;j.attempt_id:=gen_random_uuid();j.submitted_at:=now();
 insert into ikigai_jft_scores.results select(j).*;
 r:=public.ikigai_completion_reward('jft_exam',j.attempt_id);
 if (r->>'coins_total')::int<>baseline+700 then raise exception 'JFT exam trigger missing';end if;
 select * into g from public.ikigai_grammar_results limit 1;g.user_id:=u;g.attempt_id:=gen_random_uuid();g.created_at:=now();
 select coalesce(min(id),0)-1 into g.id from public.ikigai_grammar_results;
 insert into public.ikigai_grammar_results overriding system value select(g).*;
 r:=public.ikigai_completion_reward('grammar_exam',g.attempt_id);
 if (r->>'coins_total')::int<>baseline+900 then raise exception 'Grammar exam trigger missing';end if;
 select * into a from ikigai_n4_private.attempts where result is not null limit 1;a.id:=gen_random_uuid();a.user_id:=u;a.created_at:=now();
 a.result:=a.result||jsonb_build_object('attempt_id',a.id,'created_at',now());
 insert into ikigai_n4_private.attempts select(a).*;
 r:=public.ikigai_completion_reward('n4_exam',a.id);
 if (r->>'coins_total')::int<>baseline+1100 then raise exception 'N4 exam trigger missing';end if;
 if has_function_privilege('anon','public.ikigai_completion_reward(text,uuid)','EXECUTE')
 or has_schema_privilege('authenticated','ikigai_rewards_private','USAGE') then raise exception 'Reward privilege leak';end if;
end $$;
rollback;
select 'completion integration tests passed; all test changes rolled back' as result;
