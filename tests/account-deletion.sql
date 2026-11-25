-- Synthetic accounts only. Every change, including deletions, is rolled back.
begin;
do $test$
declare target uuid:=gen_random_uuid(); other_id uuid:=gen_random_uuid();
 teacher_id uuid; protected_id uuid:=gen_random_uuid(); result jsonb; row_data jsonb; item text; assignment uuid; n integer;
begin
 select id into teacher_id from auth.users where deleted_at is null and raw_app_meta_data->>'role'='teacher' limit 1;
 if teacher_id is null then raise exception 'No teacher'; end if;
 insert into auth.users(id,email,is_anonymous,created_at,raw_user_meta_data,raw_app_meta_data)
 values(target,target::text||'@deletion-test.invalid',false,now()-interval '30 days','{"nickname":"QA delete"}','{}'),
 (other_id,other_id::text||'@deletion-test.invalid',false,now(),'{}','{}'),
 (protected_id,protected_id::text||'@deletion-test.invalid',false,now(),'{}','{"role":"teacher"}');
 insert into public.ikigai_world_profiles(user_id,nickname) values(target,'QA delete'),(other_id,'QA keep');
 insert into private.ikigai_diary_clock values(target,now()-interval '15 days',false,'map','QA');
 insert into public.ikigai_learning_diary values(target,current_date-15,'map','QA',10,now()-interval '15 days',now()-interval '15 days');
 insert into ikigai_rewards_private.runs(user_id,source,attempt,ids) values(target,'qa',gen_random_uuid(),'{}');
 insert into ikigai_rewards_private.ledger(user_id,source,attempt,amount,reason) values(target,'qa',gen_random_uuid(),50,'qa');
 insert into ikigai_rewards_private.policy_attempts values(target,'qa','qa',gen_random_uuid(),1,1,10,50,now());
 insert into ikigai_rewards_private.backfill_jft_173 values(gen_random_uuid(),target,0,0);
 select id into item from ikigai_shop_private.catalog where kind='character' limit 1;
 if item is not null then
  insert into ikigai_shop_private.inventory(user_id,item_id) values(target,item);
  insert into public.ikigai_world_cosmetics(user_id,character_id) values(target,item);
 end if;
 insert into ikigai_tasks_private.assignments(room,source,lesson_key,title,student_id,created_by)
 values('class','kotoba','lesson:1','QA deletion',target,teacher_id);
 insert into public.ikigai_assignments(title,category,lesson_no,question_ids,assigned_to,created_by)
 values('QA shared','vocab',1,'{}',array[target,other_id],teacher_id) returning id into assignment;
 insert into ikigai_n4_private.attempts(id,user_id,exam_id,snapshot,answers,section,deadline)
 select gen_random_uuid(),target,id,'{}','{}',0,now() from ikigai_n4_private.exams limit 1;
 insert into ikigai_n5_private.attempts(id,user_id,exam_id,snapshot,answers,section,deadline)
 select gen_random_uuid(),target,id,'{}','{}',0,now() from ikigai_n5_private.exams limit 1;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'role','authenticated','app_metadata',jsonb_build_object('role','teacher'))::text,true);
 execute 'set local role authenticated';
 begin perform public.ikigai_registration_delete(target,target::text||'@deletion-test.invalid',null);raise exception 'Student deletion accepted';exception when insufficient_privilege then null;end;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',teacher_id,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 begin perform public.ikigai_registration_delete(teacher_id,'wrong',null);raise exception 'Self deletion accepted';exception when insufficient_privilege then null;end;
 begin perform public.ikigai_registration_delete(protected_id,protected_id::text||'@deletion-test.invalid',null);raise exception 'Other teacher deletion accepted';exception when insufficient_privilege then null;end;
 result:=public.ikigai_registration_list();
 select x into row_data from jsonb_array_elements(result) x where x->>'user_id'=target::text;
 if row_data is null or row_data->>'last_activity_at' is null or (row_data->>'is_online')::boolean then raise exception 'Activity list incorrect';end if;
 begin
  perform public.ikigai_registration_delete(target,'wrong',(row_data->>'last_activity_at')::timestamptz);
  raise exception 'Wrong email accepted';
 exception when raise_exception then if sqlerrm='Wrong email accepted' then raise;end if;end;
 begin
  perform public.ikigai_registration_delete(target,target::text||'@deletion-test.invalid',null);
  raise exception 'Stale activity accepted';
 exception when raise_exception then if sqlerrm='Stale activity accepted' then raise;end if;end;
 execute 'reset role';
 update private.ikigai_diary_clock set seen_at=clock_timestamp(),active=true where user_id=target;
 execute 'set local role authenticated';
 result:=public.ikigai_registration_list();
 select x into row_data from jsonb_array_elements(result) x where x->>'user_id'=target::text;
 begin
  perform public.ikigai_registration_delete(target,target::text||'@deletion-test.invalid',(row_data->>'last_activity_at')::timestamptz);
  raise exception 'Online deletion accepted';
 exception when raise_exception then if sqlerrm='Online deletion accepted' then raise;end if;end;
 execute 'reset role';
 update private.ikigai_diary_clock set active=false,seen_at=now()-interval '15 days' where user_id=target;
 execute 'set local role authenticated';
 result:=public.ikigai_registration_list();
 select x into row_data from jsonb_array_elements(result) x where x->>'user_id'=target::text;
 result:=public.ikigai_registration_delete(target,target::text||'@deletion-test.invalid',(row_data->>'last_activity_at')::timestamptz);
 if result->>'deleted'<>'true' then raise exception 'Deletion failed';end if;
 execute 'reset role';
 if exists(select 1 from auth.users where id=target) or exists(select 1 from public.ikigai_world_profiles where user_id=target)
 or exists(select 1 from ikigai_rewards_private.policy_attempts where user_id=target)
 or exists(select 1 from ikigai_tasks_private.assignments where student_id=target)
 or exists(select 1 from ikigai_shop_private.inventory where user_id=target)
 or exists(select 1 from ikigai_n4_private.attempts where user_id=target)
 or exists(select 1 from ikigai_n5_private.attempts where user_id=target)
 or exists(select 1 from private.ikigai_registrations where user_id=target) then raise exception 'Orphan account data';end if;
 if not exists(select 1 from auth.users where id=other_id) or not exists(select 1 from auth.users where id=teacher_id)
 or not exists(select 1 from public.ikigai_assignments where id=assignment and assigned_to=array[other_id]) then raise exception 'Other user/shared content affected';end if;
 if not exists(select 1 from private.ikigai_account_deletions where actor_id=teacher_id and target_id=target) then raise exception 'Missing audit';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',target,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if private.ikigai_member_allowed() then raise exception 'Old token still allowed';end if;
 execute 'reset role';
 if has_function_privilege('anon','public.ikigai_registration_delete(uuid,text,timestamptz)','EXECUTE') then raise exception 'Anonymous can call deletion';end if;
end $test$;
select 'PASS: teacher-only deletion; email, activity and online guards; dependent data removed; other accounts and shared assignment preserved; old-token access denied; audit recorded. All changes rolled back.' as checks;
rollback;
