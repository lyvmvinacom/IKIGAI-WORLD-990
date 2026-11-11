-- Shared teacher imports. Original exams and all historical results are preserved.
create table ikigai_jft_scores.packages (
 exam_id text primary key references ikigai_jft_scores.exam_keys(exam_id),
 title text not null, source text not null, minutes integer not null,
 payload_text text not null, created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table ikigai_jft_scores.packages enable row level security;
revoke all on ikigai_jft_scores.packages from public, anon, authenticated;

create function ikigai_jft_scores.can_read_packages() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from auth.users u join public.ikigai_world_profiles p on p.user_id=u.id
 where u.id=(select auth.uid()) and not coalesce(u.is_anonymous,false)
 and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now())
 and p.role in ('student','teacher'));
$$;
create function ikigai_jft_scores.can_import_packages() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from auth.users u where u.id=(select auth.uid())
 and not coalesce(u.is_anonymous,false) and u.email_confirmed_at is not null
 and (u.banned_until is null or u.banned_until<=now()) and u.raw_app_meta_data->>'role'='teacher');
$$;

create function ikigai_jft_scores.catalog() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if not ikigai_jft_scores.can_read_packages() then raise insufficient_privilege using message='Cần đăng nhập tài khoản học viên hoặc giáo viên.'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',exam_id,'title',title,'source',source,'minutes',minutes,'questionCount',50) order by created_at,exam_id),'[]'::jsonb) from ikigai_jft_scores.packages);
end;$$;
create function ikigai_jft_scores.package(p_exam_id text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare payload text;
begin
 if not ikigai_jft_scores.can_read_packages() then raise insufficient_privilege using message='Cần đăng nhập tài khoản học viên hoặc giáo viên.'; end if;
 select payload_text into payload from ikigai_jft_scores.packages where exam_id=p_exam_id;
 if not found then raise invalid_parameter_value using message='Không tìm thấy đề.'; end if;
 return payload;
end;$$;

create function ikigai_jft_scores.import_packages(p_package_text text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare data jsonb; test jsonb; q jsonb; turn jsonb; payload text; proof text; result jsonb:='[]'::jsonb;
 answers integer[]; sections integer[]; counts integer[]; sec integer; idx integer;
begin
 if not ikigai_jft_scores.can_import_packages() then raise insufficient_privilege using message='Chỉ giáo viên được nạp đề dùng chung.'; end if;
 if p_package_text is null or octet_length(p_package_text)>33554432 then raise invalid_parameter_value using message='Tệp vượt giới hạn 32 MB.'; end if;
 data:=p_package_text::jsonb;
 if data->>'format' is distinct from 'ikigai-jft-1' or coalesce(length(trim(data->>'source')),0) not between 1 and 200
 or jsonb_typeof(data->'tests') is distinct from 'array' then raise invalid_parameter_value using message='Tệp không đúng định dạng IKIGAI JFT.'; end if;
 if jsonb_array_length(data->'tests') not between 1 and 10 then raise invalid_parameter_value using message='Mỗi lần nạp từ 1 đến 10 đề.'; end if;
 for test in select value from jsonb_array_elements(data->'tests') loop
  if (test->>'id') is null or test->>'id' !~ '^[a-z0-9][a-z0-9-]{0,49}$' or test->>'id'='ikigai-demo'
  or coalesce(length(trim(test->>'title')),0) not between 1 and 120
  or coalesce(test->>'minutes','') !~ '^[0-9]{1,3}$' or (test->>'minutes')::int not between 1 and 180
  or jsonb_typeof(test->'questions') is distinct from 'array' then raise invalid_parameter_value using message='Mã đề, tên hoặc thời lượng không hợp lệ.'; end if;
  if jsonb_array_length(test->'questions')<>50 then raise invalid_parameter_value using message='Đề dùng chung cần đủ 50 câu.'; end if;
  if exists(select 1 from ikigai_jft_scores.exam_keys k where k.exam_id=test->>'id') then raise unique_violation using message='Mã đề đã tồn tại: '||(test->>'id')||'. Hãy dùng mã mới; không ghi đè đề cũ.'; end if;
  answers:='{}'; sections:='{}'; counts:='{}'; idx:=0;
  for q in select value from jsonb_array_elements(test->'questions') loop
   idx:=idx+1;
   if coalesce(q->>'section','') !~ '^[0-3]$' or coalesce(q->>'correct','') !~ '^[0-3]$'
   or coalesce(length(trim(q->>'instruction')),0) not between 1 and 500
   or q->>'prompt' is null or length(q->>'prompt')>3000
   or coalesce(length(trim(q->>'explanation')),0) not between 1 and 5000
   or jsonb_typeof(q->'options') is distinct from 'array' then raise invalid_parameter_value using message='Câu '||idx||' thiếu nội dung hoặc đáp án.'; end if;
   if jsonb_array_length(q->'options') not between 2 and 4 or (q->>'correct')::int>=jsonb_array_length(q->'options')
   or exists(select 1 from jsonb_array_elements(q->'options') o where jsonb_typeof(o)<>'string' or length(trim(o#>>'{}')) not between 1 and 2500)
   then raise invalid_parameter_value using message='Lựa chọn hoặc đáp án đúng không hợp lệ ở câu '||idx; end if;
   sec:=(q->>'section')::int;
   if sec=2 then
    if coalesce(length(trim(q#>>'{listen,questionVi}')),0) not between 1 and 1500
    or coalesce(length(trim(q#>>'{listen,question}')),0) not between 1 and 1500
    or coalesce(q#>>'{listen,mp3}','') !~ '^[A-Za-z0-9+/]+={0,2}$'
    or length(q#>>'{listen,mp3}')>850000 or length(q#>>'{listen,mp3}')%4<>0
    or jsonb_typeof(q#>'{listen,turns}') is distinct from 'array' then raise invalid_parameter_value using message='Câu nghe '||idx||' thiếu câu hỏi tiếng Việt, hội thoại hoặc MP3.'; end if;
    if jsonb_array_length(q#>'{listen,turns}') not between 1 and 20 then raise invalid_parameter_value using message='Hội thoại không hợp lệ.'; end if;
    for turn in select value from jsonb_array_elements(q#>'{listen,turns}') loop
     if jsonb_typeof(turn) is distinct from 'array' or jsonb_array_length(turn)<>2 or coalesce(turn->>0,'') not in ('Nam','Nữ') or coalesce(length(trim(turn->>1)),0) not between 1 and 5000 then raise invalid_parameter_value using message='Lượt thoại không hợp lệ.'; end if;
    end loop;
   elsif coalesce(q->>'prompt','')='' and coalesce(q->>'figure','')='' and coalesce(q->>'passage','')='' then
    raise invalid_parameter_value using message='Câu '||idx||' chưa có nội dung.';
   end if;
   answers:=array_append(answers,(q->>'correct')::int); sections:=array_append(sections,sec); counts:=array_append(counts,jsonb_array_length(q->'options'));
  end loop;
  if (select count(*) from unnest(sections) s where s=2)<>12 or (select count(distinct s) from unnest(sections) s)<>4 then raise invalid_parameter_value using message='Đề cần đủ 4 phần và 12 câu nghe.'; end if;
  payload:=jsonb_build_object('format','ikigai-jft-1','source',data->>'source','tests',jsonb_build_array(test))::text;
  proof:=encode(sha256(convert_to('ikigai-world-jft:score-proof:v2:'||payload,'UTF8')),'hex');
  insert into ikigai_jft_scores.exam_keys values(test->>'id',answers,sections,counts,sha256(convert_to(proof,'UTF8')));
  insert into ikigai_jft_scores.packages(exam_id,title,source,minutes,payload_text,created_by)
  values(test->>'id',test->>'title',data->>'source',(test->>'minutes')::int,payload,auth.uid());
  result:=result||jsonb_build_array(jsonb_build_object('id',test->>'id','title',test->>'title','source',data->>'source','minutes',(test->>'minutes')::int,'questionCount',50));
 end loop;
 return result;
end;$$;

create function public.ikigai_jft_catalog() returns jsonb language sql set search_path='' as $$select ikigai_jft_scores.catalog();$$;
create function public.ikigai_jft_package(p_exam_id text) returns text language sql set search_path='' as $$select ikigai_jft_scores.package(p_exam_id);$$;
create function public.ikigai_jft_import(p_package_text text) returns jsonb language sql set search_path='' as $$select ikigai_jft_scores.import_packages(p_package_text);$$;
revoke all on function ikigai_jft_scores.can_read_packages(),ikigai_jft_scores.can_import_packages(),ikigai_jft_scores.catalog(),ikigai_jft_scores.package(text),ikigai_jft_scores.import_packages(text),public.ikigai_jft_catalog(),public.ikigai_jft_package(text),public.ikigai_jft_import(text) from public,anon;
grant execute on function ikigai_jft_scores.catalog(),ikigai_jft_scores.package(text),ikigai_jft_scores.import_packages(text),public.ikigai_jft_catalog(),public.ikigai_jft_package(text),public.ikigai_jft_import(text) to authenticated;
