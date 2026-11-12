-- Staged for review. Do not publish/import exam content until IKIGAI approves the demo.
create schema if not exists ikigai_n4_private;
revoke all on schema ikigai_n4_private from public,anon,authenticated;
create table if not exists ikigai_n4_private.exams(id text primary key,payload jsonb not null,revision integer not null default 1);
create table if not exists ikigai_n4_private.attempts(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),exam_id text not null references ikigai_n4_private.exams(id),snapshot jsonb not null,answers jsonb not null,section integer not null default 0 check(section between 0 and 2),deadline timestamptz not null,listen_started timestamptz,result jsonb,created_at timestamptz not null default now());
alter table ikigai_n4_private.exams enable row level security;
alter table ikigai_n4_private.attempts enable row level security;
create unique index if not exists n4_one_active on ikigai_n4_private.attempts(user_id,exam_id) where result is null;
create index if not exists n4_attempt_user on ikigai_n4_private.attempts(user_id,created_at desc);
revoke all on all tables in schema ikigai_n4_private from public,anon,authenticated;
create or replace function ikigai_n4_private.member_id() returns uuid language plpgsql set search_path='' as $$
declare uid uuid:=auth.uid();begin
 if not exists(select 1 from auth.users u where u.id=uid and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now())) then raise insufficient_privilege using message='Cần đăng nhập tài khoản IKIGAI.';end if;return uid;end$$;
create or replace function ikigai_n4_private.teacher_id() returns uuid language plpgsql set search_path='' as $$
declare uid uuid:=ikigai_n4_private.member_id();begin if not exists(select 1 from auth.users where id=uid and raw_app_meta_data->>'role'='teacher') then raise insufficient_privilege using message='Chỉ giáo viên được sửa đề N4.';end if;return uid;end$$;
create or replace function ikigai_n4_private.public_exam(e jsonb) returns jsonb language sql immutable set search_path='' as $$
 select (e-'solutions')||jsonb_build_object('sections',(select jsonb_agg(s.value||jsonb_build_object('questions',(select jsonb_agg(q.value-'answer'-'explanation' order by q.ordinality) from jsonb_array_elements(s.value->'questions') with ordinality q)) order by s.ordinality) from jsonb_array_elements(e->'sections') with ordinality s));
$$;
create or replace function ikigai_n4_private.state(a ikigai_n4_private.attempts) returns jsonb language sql stable set search_path='' as $$select jsonb_build_object('id',a.id,'exam',ikigai_n4_private.public_exam(a.snapshot),'answers',a.answers,'section',a.section,'deadline',a.deadline,'listen_started',a.listen_started,'result',a.result);$$;
create or replace function public.ikigai_n4_list() returns jsonb language plpgsql security definer set search_path='' as $$begin perform ikigai_n4_private.member_id();return coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',payload->>'title','audioSeconds',payload->'audioSeconds') order by id) from ikigai_n4_private.exams),'[]');end$$;
create or replace function public.ikigai_n4_start(p_exam text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=ikigai_n4_private.member_id();a ikigai_n4_private.attempts;e jsonb;initial jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended(uid::text||p_exam,0));
 select * into a from ikigai_n4_private.attempts where user_id=uid and exam_id=p_exam and result is null for update;if found then return ikigai_n4_private.state(a);end if;
 select payload into e from ikigai_n4_private.exams where id=p_exam;if e is null then raise exception 'Chưa có đề N4 này';end if;
 select jsonb_agg((select jsonb_agg(-1 order by q.ordinality) from jsonb_array_elements(s.value->'questions') with ordinality q) order by s.ordinality) into initial from jsonb_array_elements(e->'sections') with ordinality s;
 insert into ikigai_n4_private.attempts(user_id,exam_id,snapshot,answers,deadline) values(uid,p_exam,e,initial,now()+interval '25 minutes') returning * into a;return ikigai_n4_private.state(a);end$$;
create or replace function public.ikigai_n4_answer(p_attempt uuid,p_section integer,p_index integer,p_value integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=ikigai_n4_private.member_id();a ikigai_n4_private.attempts;q jsonb;begin
 select * into a from ikigai_n4_private.attempts where id=p_attempt and user_id=uid for update;
 if not found or a.result is not null or p_section is distinct from a.section then raise exception 'Phần thi đã khóa';end if;
 if now()>a.deadline then raise exception 'Phần thi đã hết giờ';end if;
 if p_index is null or p_index<0 or p_index>=jsonb_array_length(a.snapshot->'sections'->a.section->'questions') then raise exception 'Câu hỏi không hợp lệ';end if;
 q:=a.snapshot->'sections'->a.section->'questions'->p_index;
 if p_value is null or p_value<0 or p_value>=(q->>'options')::int then raise exception 'Đáp án không hợp lệ';end if;
 update ikigai_n4_private.attempts set answers=jsonb_set(answers,array[a.section::text,p_index::text],to_jsonb(p_value)) where id=p_attempt;
 return jsonb_build_object('saved',true);end$$;
create or replace function public.ikigai_n4_listen(p_attempt uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=ikigai_n4_private.member_id();a ikigai_n4_private.attempts;begin
 select * into a from ikigai_n4_private.attempts where id=p_attempt and user_id=uid for update;
 if not found or a.result is not null or a.section<>2 then raise exception 'Chưa ở phần nghe';end if;
 if a.listen_started is null then update ikigai_n4_private.attempts set listen_started=now(),deadline=now()+make_interval(secs=>(snapshot->>'audioSeconds')::double precision+10) where id=p_attempt returning * into a;end if;
 return jsonb_build_object('started_at',a.listen_started,'deadline',a.deadline);end$$;
create or replace function public.ikigai_n4_advance(p_attempt uuid,p_section integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=ikigai_n4_private.member_id();a ikigai_n4_private.attempts;s jsonb;q jsonb;si integer;qi integer;ans integer;counts integer[]:=array[0,0,0];refs integer[]:=array[0,0,0];totals integer[]:=array[0,0,0];g integer;written integer;listening integer;r jsonb;begin
 select * into a from ikigai_n4_private.attempts where id=p_attempt and user_id=uid for update;
 if not found then raise exception 'Không tìm thấy lượt thi';end if;if a.result is not null then return ikigai_n4_private.state(a);end if;
 if p_section is distinct from a.section then return ikigai_n4_private.state(a);end if;
 if a.section<2 then update ikigai_n4_private.attempts set section=section+1,deadline=now()+make_interval(secs=>(snapshot->'sections'->(section+1)->>'seconds')::double precision) where id=p_attempt returning * into a;return ikigai_n4_private.state(a);end if;
 for si in 0..2 loop s:=a.snapshot->'sections'->si;for qi in 0..jsonb_array_length(s->'questions')-1 loop
 q:=s->'questions'->qi;ans:=(a.answers->si->>qi)::int;if ans=(q->>'answer')::int then counts[si+1]:=counts[si+1]+1;end if;
 g:=case q->>'group' when 'vocabulary' then 1 when 'grammar' then 2 when 'reading' then 3 else 0 end;
 if g>0 then totals[g]:=totals[g]+1;if ans=(q->>'answer')::int then refs[g]:=refs[g]+1;end if;end if;
 end loop;end loop;
 written:=round((counts[1]+counts[2])*120.0/70);listening:=round(counts[3]*60.0/28);
 r:=jsonb_build_object('attempt_id',a.id,'title',a.snapshot->>'title','nickname',coalesce((select nickname from public.ikigai_world_profiles where user_id=uid),'Học viên'),'created_at',now(),'written',written,'listening',listening,'total',written+listening,'passed',written+listening>=90 and written>=38 and listening>=19,'method','IKIGAI_LINEAR_V1','references',(select jsonb_agg(jsonb_build_object('group',(array['vocabulary','grammar','reading'])[i],'correct',refs[i],'total',totals[i],'grade',case when refs[i]*1.0/totals[i]>=.67 then 'A' when refs[i]*1.0/totals[i]>=.34 then 'B' else 'C' end) order by i) from generate_series(1,3) i));
 update ikigai_n4_private.attempts set result=r where id=p_attempt returning * into a;return ikigai_n4_private.state(a);end$$;
create or replace function public.ikigai_n4_recent() returns jsonb language plpgsql security definer set search_path='' as $$declare uid uuid:=ikigai_n4_private.member_id();begin return coalesce((select jsonb_agg(result order by created_at desc) from (select result,created_at from ikigai_n4_private.attempts where user_id=uid and result is not null order by created_at desc limit 50) a),'[]');end$$;
create or replace function public.ikigai_n4_review(p_attempt uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare uid uuid:=ikigai_n4_private.member_id();a ikigai_n4_private.attempts;begin
 select * into a from ikigai_n4_private.attempts where id=p_attempt and result is not null and (user_id=uid or exists(select 1 from auth.users where id=uid and raw_app_meta_data->>'role'='teacher'));
 if not found then raise insufficient_privilege using message='Chỉ mở chữa bài sau khi hoàn thành lượt thi.';end if;return jsonb_build_object('exam',a.snapshot,'answers',a.answers);end$$;
create or replace function public.ikigai_n4_teacher_exam(p_exam text) returns jsonb language plpgsql security definer set search_path='' as $$declare e jsonb;begin perform ikigai_n4_private.teacher_id();select payload into e from ikigai_n4_private.exams where id=p_exam;return e;end$$;
create or replace function public.ikigai_n4_edit(p_exam text,p_section integer,p_index integer,p_before jsonb,p_question jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare e jsonb;q jsonb;updated jsonb;begin
 perform ikigai_n4_private.teacher_id();select payload into e from ikigai_n4_private.exams where id=p_exam for update;
 if p_section is null or p_section not between 0 and 2 or p_index is null or p_index<0 or p_index>=jsonb_array_length(e->'sections'->p_section->'questions') then raise exception 'Câu hỏi không hợp lệ';end if;
 q:=e->'sections'->p_section->'questions'->p_index;if q is distinct from p_before then raise exception 'Câu hỏi đã thay đổi. Hãy mở lại đề.';end if;
 if jsonb_typeof(p_question->'answer') is distinct from 'number' or (p_question->>'answer')::numeric<>trunc((p_question->>'answer')::numeric) or (p_question->>'answer')::int<0 or (p_question->>'answer')::int>=(q->>'options')::int or length(coalesce(p_question->>'prompt',''))>10000 or length(coalesce(p_question->>'explanation',''))>20000 then raise exception 'Nội dung không hợp lệ';end if;
 if jsonb_typeof(p_question->'optionTexts') is distinct from 'array' or jsonb_array_length(p_question->'optionTexts')<>(q->>'options')::int then raise exception 'Cần đủ lựa chọn';end if;
 if exists(select 1 from jsonb_array_elements(p_question->'optionTexts') v where jsonb_typeof(v)<>'string' or length(v#>>'{}')>2000) then raise exception 'Lựa chọn không hợp lệ';end if;
 if coalesce((p_question->>'hideImage')::boolean,false) and (length(trim(p_question->>'prompt'))=0 or exists(select 1 from jsonb_array_elements_text(p_question->'optionTexts') v where length(trim(v))=0)) then raise exception 'Cần đủ câu hỏi và các lựa chọn khi ẩn hình nguồn';end if;
 updated:=q||jsonb_build_object('hideImage',coalesce((p_question->>'hideImage')::boolean,false),'answer',p_question->'answer','prompt',coalesce(p_question->>'prompt',''),'explanation',coalesce(p_question->>'explanation',''),'optionTexts',p_question->'optionTexts');
 update ikigai_n4_private.exams set payload=jsonb_set(e,array['sections',p_section::text,'questions',p_index::text],updated),revision=revision+1 where id=p_exam;return updated;end$$;
revoke all on all functions in schema ikigai_n4_private from public,anon,authenticated;
revoke all on function public.ikigai_n4_list(),public.ikigai_n4_start(text),public.ikigai_n4_answer(uuid,integer,integer,integer),public.ikigai_n4_listen(uuid),public.ikigai_n4_advance(uuid,integer),public.ikigai_n4_recent(),public.ikigai_n4_review(uuid),public.ikigai_n4_teacher_exam(text),public.ikigai_n4_edit(text,integer,integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.ikigai_n4_list(),public.ikigai_n4_start(text),public.ikigai_n4_answer(uuid,integer,integer,integer),public.ikigai_n4_listen(uuid),public.ikigai_n4_advance(uuid,integer),public.ikigai_n4_recent(),public.ikigai_n4_review(uuid),public.ikigai_n4_teacher_exam(text),public.ikigai_n4_edit(text,integer,integer,jsonb,jsonb) to authenticated;
