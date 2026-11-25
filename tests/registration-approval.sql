begin;
do $test$
declare member_id uuid:=gen_random_uuid(); rejected_id uuid:=gen_random_uuid(); teacher_id uuid; current_id uuid; result jsonb; n int;
begin
 select id into teacher_id from auth.users where raw_app_meta_data->>'role'='teacher' and deleted_at is null limit 1;
 if teacher_id is null then raise exception 'No teacher exists'; end if;
 insert into auth.users(id,email,is_anonymous,raw_user_meta_data,raw_app_meta_data)
 values(member_id,member_id::text||'@approval-test.invalid',false,'{"nickname":"QA Pending","role":"teacher"}','{"provider":"email","providers":["email"]}'),
 (rejected_id,rejected_id::text||'@approval-test.invalid',false,'{"nickname":"QA Rejected"}','{"provider":"email","providers":["email"]}');
 if (select status from private.ikigai_registrations where user_id=member_id)<>'pending' then raise exception 'New account not pending'; end if;
 begin insert into auth.users(id,is_anonymous) values(gen_random_uuid(),true);raise exception 'Anonymous signup accepted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_id,'role','authenticated','app_metadata',jsonb_build_object('role','teacher'),'is_anonymous',false)::text,true);
 execute 'set local role authenticated';
 result:=public.ikigai_account_status();
 if result->>'status'<>'pending' or (result->>'allowed')::boolean then raise exception 'Pending gained access';end if;
 begin perform public.ikigai_registration_list();raise exception 'Pending listed registrations';exception when insufficient_privilege then null;end;
 begin perform public.ikigai_registration_review(member_id,'approved');raise exception 'Self approval accepted';exception when insufficient_privilege then null;end;
 begin perform count(*) from private.ikigai_registrations;raise exception 'Private approval table exposed';exception when insufficient_privilege then null;end;
 perform set_config('request.path','/rpc/ikigai_shop_state',true);
 begin perform private.ikigai_check_request();raise exception 'Pending REST/RPC allowed';exception when insufficient_privilege then null;end;
 perform set_config('request.path','/rpc/ikigai_account_status',true);perform private.ikigai_check_request();
 if private.ikigai_member_allowed() then raise exception 'Metadata spoof accepted';end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',teacher_id,'role','authenticated','is_anonymous',false)::text,true);
 execute 'set local role authenticated';
 result:=public.ikigai_registration_list();
 if not exists(select 1 from jsonb_array_elements(result) r where r->>'user_id'=member_id::text and r->>'status'='pending') then raise exception 'Teacher cannot see pending request';end if;
 result:=public.ikigai_registration_review(member_id,'approved');
 if result->>'status'<>'approved' then raise exception 'Teacher approval failed';end if;
 result:=public.ikigai_registration_review(rejected_id,'rejected');
 if result->>'status'<>'rejected' then raise exception 'Teacher rejection failed';end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_id,'role','authenticated','is_anonymous',false)::text,true);
 execute 'set local role authenticated';result:=public.ikigai_account_status();
 if not (result->>'allowed')::boolean then raise exception 'Approval did not grant access immediately';end if;
 perform set_config('request.path','/rpc/ikigai_world_leaderboard',true);perform private.ikigai_check_request();perform public.ikigai_world_leaderboard();
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',rejected_id,'role','authenticated','is_anonymous',false)::text,true);
 execute 'set local role authenticated';result:=public.ikigai_account_status();
 if (result->>'allowed')::boolean or result->>'status'<>'rejected' then raise exception 'Rejected gained access';end if;
 execute 'reset role';
 if has_table_privilege('authenticated','private.ikigai_registrations','UPDATE') then raise exception 'Approval table writable';end if;
 if not exists(select 1 from pg_policy where polrelid='storage.objects'::regclass and polname='ikigai_approved_members_only' and not polpermissive) then raise exception 'Storage not protected';end if;
end $test$;
select 'PASS: new pending, anonymous denied, role spoof denied, self approval denied, teacher list/approve/reject, immediate access after approval, rejection blocked, private table isolation, storage gate' as checks;
rollback;
