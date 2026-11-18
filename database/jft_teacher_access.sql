-- Teacher-controlled entry for selected exams; existing exams remain unrestricted.
begin;
create table ikigai_jft_scores.exam_access (
 exam_id text primary key references ikigai_jft_scores.exam_keys(exam_id),
 is_open boolean not null default false,
 revision bigint not null default 1 check(revision>0),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table ikigai_jft_scores.exam_access enable row level security;
revoke all on ikigai_jft_scores.exam_access from public,anon,authenticated;
create function ikigai_jft_scores.can_enter_exam(p_exam_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select ikigai_jft_scores.can_read_packages() and
 (ikigai_jft_scores.can_import_packages() or not exists(select 1 from ikigai_jft_scores.exam_access where exam_id=p_exam_id and not is_open));
$$;
revoke all on function ikigai_jft_scores.can_enter_exam(text) from public,anon,authenticated;
create function ikigai_jft_scores.access_put(p_exam_id text,p_is_open boolean,p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved ikigai_jft_scores.exam_access;
begin
 if not ikigai_jft_scores.can_import_packages() then raise insufficient_privilege using message='Chỉ giáo viên được mở hoặc đóng đề.';end if;
 if p_is_open is null or p_expected_revision is null then raise invalid_parameter_value using message='Trạng thái đề không hợp lệ.';end if;
 update ikigai_jft_scores.exam_access set is_open=p_is_open,revision=revision+1,updated_by=auth.uid(),updated_at=now()
 where exam_id=p_exam_id and revision=p_expected_revision returning * into saved;
 if not found then raise serialization_failure using message='Trạng thái đề đã thay đổi. Hãy cập nhật danh sách rồi thử lại.';end if;
 return jsonb_build_object('controlled',true,'open',saved.is_open,'revision',saved.revision);
end;$$;
create function public.ikigai_jft_access_put(p_exam_id text,p_is_open boolean,p_expected_revision bigint) returns jsonb
language sql security invoker set search_path='' as $$select ikigai_jft_scores.access_put(p_exam_id,p_is_open,p_expected_revision);$$;
revoke all on function ikigai_jft_scores.access_put(text,boolean,bigint),public.ikigai_jft_access_put(text,boolean,bigint) from public,anon;
grant execute on function ikigai_jft_scores.access_put(text,boolean,bigint),public.ikigai_jft_access_put(text,boolean,bigint) to authenticated;
CREATE OR REPLACE FUNCTION ikigai_jft_scores.audio_get(p_exam_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not ikigai_jft_scores.can_read_packages() then raise insufficient_privilege using message='Cần đăng nhập IKIGAI.'; end if;
 if not ikigai_jft_scores.can_enter_exam(p_exam_id) then raise insufficient_privilege using message='Giáo viên chưa mở đề này. Vui lòng chờ giáo viên mở đề.';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('number',question_number,'mp3',mp3,'sha256',sha256) order by question_number),'[]'::jsonb) from ikigai_jft_scores.audio_updates where exam_id=p_exam_id);
end;$function$;
CREATE OR REPLACE FUNCTION ikigai_jft_scores.catalog()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not ikigai_jft_scores.can_read_packages() then raise insufficient_privilege using message='Cần đăng nhập tài khoản học viên hoặc giáo viên.'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',p.exam_id,'title',p.title,'source',p.source,'minutes',p.minutes,'questionCount',50,'access',jsonb_build_object('controlled',a.exam_id is not null,'open',coalesce(a.is_open,true),'revision',coalesce(a.revision,0))) order by p.created_at,p.exam_id),'[]'::jsonb) from ikigai_jft_scores.packages p left join ikigai_jft_scores.exam_access a on a.exam_id=p.exam_id);
end;$function$;
CREATE OR REPLACE FUNCTION ikigai_jft_scores.furigana_get(p_exam_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not ikigai_jft_scores.can_read_packages() then raise insufficient_privilege using message='Cần đăng nhập IKIGAI để xem đề.'; end if;
 if not ikigai_jft_scores.can_enter_exam(p_exam_id) then raise insufficient_privilege using message='Giáo viên chưa mở đề này. Vui lòng chờ giáo viên mở đề.';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('number',question_number,'fields',fields,'revision',revision) order by question_number),'[]'::jsonb) from ikigai_jft_scores.furigana_overlays where exam_id=p_exam_id);
end;$function$;
CREATE OR REPLACE FUNCTION ikigai_jft_scores.import_packages(p_package_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare data jsonb; test jsonb; q jsonb; turn jsonb; payload text; proof text; result jsonb:='[]'::jsonb;
 answers integer[]; sections integer[]; counts integer[]; sec integer; idx integer;
 audio text; has_figure boolean; package_source text; entry jsonb; existing_payload text;
begin
 if not ikigai_jft_scores.can_import_packages() then raise insufficient_privilege using message='Chỉ giáo viên được nạp đề dùng chung.'; end if;
 if p_package_text is null or octet_length(p_package_text)>33554432 then raise invalid_parameter_value using message='Tệp vượt giới hạn 32 MB.'; end if;
 data:=p_package_text::jsonb;
 if data->>'format' is distinct from 'ikigai-jft-1' or coalesce(length(trim(data->>'source')),0) not between 1 and 200
 or jsonb_typeof(data->'tests') is distinct from 'array' then raise invalid_parameter_value using message='Tệp không đúng định dạng IKIGAI JFT.'; end if;
 package_source:=data->>'source';
 if jsonb_array_length(data->'tests') not between 1 and 10 then raise invalid_parameter_value using message='Mỗi lần nạp từ 1 đến 10 đề.'; end if;
 for test in select value from jsonb_array_elements(data->'tests') loop
  if (test->>'id') is null or test->>'id' !~ '^[a-z0-9][a-z0-9-]{0,49}$' or test->>'id'='ikigai-demo'
  or coalesce(length(trim(test->>'title')),0) not between 1 and 120
  or coalesce(test->>'minutes','') !~ '^[0-9]{1,3}$' or (test->>'minutes')::int not between 1 and 180
  or jsonb_typeof(test->'questions') is distinct from 'array' then raise invalid_parameter_value using message='Mã đề, tên hoặc thời lượng không hợp lệ.'; end if;
  if jsonb_array_length(test->'questions')<>50 then raise invalid_parameter_value using message='Đề dùng chung cần đủ 50 câu.'; end if;
  payload:=jsonb_build_object('format','ikigai-jft-1','source',package_source,'tests',jsonb_build_array(test))::text;
  entry:=jsonb_build_object('id',test->>'id','title',test->>'title','source',package_source,'minutes',(test->>'minutes')::int,'questionCount',50);
  if exists(select 1 from ikigai_jft_scores.exam_keys k where k.exam_id=test->>'id') then
   select payload_text into existing_payload from ikigai_jft_scores.packages where exam_id=test->>'id';
   if existing_payload is not distinct from payload then result:=result||jsonb_build_array(entry); continue; end if;
   raise unique_violation using message='Mã đề đã tồn tại với nội dung khác: '||(test->>'id')||'. Hãy dùng mã mới; không ghi đè đề cũ.';
  end if;
  answers:='{}'; sections:='{}'; counts:='{}'; idx:=0;
  for q in select value from jsonb_array_elements(test->'questions') loop
   idx:=idx+1;
   -- Avoid repeatedly copying large embedded media during scalar validation.
   has_figure:=coalesce(q->>'figure','')<>'';
   audio:=q#>>'{listen,mp3}';
   q:=q-array['figure','sourceView'];
   if q ? 'listen' then q:=jsonb_set(q,'{listen}',(q->'listen')-'mp3'); end if;
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
    or audio is null or length(audio) not between 4 and 850000
    or length(audio)%4<>0 or audio ~ '[^A-Za-z0-9+/=]'
    or jsonb_typeof(q#>'{listen,turns}') is distinct from 'array' then raise invalid_parameter_value using message='Câu nghe '||idx||' thiếu câu hỏi tiếng Việt, hội thoại hoặc MP3.'; end if;
    begin
     if octet_length(decode(audio,'base64'))=0 then raise invalid_parameter_value; end if;
    exception when invalid_parameter_value then raise invalid_parameter_value using message='MP3 base64 không hợp lệ ở câu '||idx;
    end;
    if jsonb_array_length(q#>'{listen,turns}') not between 1 and 20 then raise invalid_parameter_value using message='Hội thoại không hợp lệ.'; end if;
    for turn in select value from jsonb_array_elements(q#>'{listen,turns}') loop
     if jsonb_typeof(turn) is distinct from 'array' or jsonb_array_length(turn)<>2 or coalesce(turn->>0,'') not in ('Nam','Nữ') or coalesce(length(trim(turn->>1)),0) not between 1 and 5000 then raise invalid_parameter_value using message='Lượt thoại không hợp lệ.'; end if;
    end loop;
   elsif coalesce(q->>'prompt','')='' and not has_figure and coalesce(q->>'passage','')='' then
    raise invalid_parameter_value using message='Câu '||idx||' chưa có nội dung.';
   end if;
   answers:=array_append(answers,(q->>'correct')::int); sections:=array_append(sections,sec); counts:=array_append(counts,jsonb_array_length(q->'options'));
  end loop;
  if (select count(*) from unnest(sections) s where s=2)<>12 or (select count(distinct s) from unnest(sections) s)<>4 then raise invalid_parameter_value using message='Đề cần đủ 4 phần và 12 câu nghe.'; end if;
  proof:=encode(sha256(convert_to('ikigai-world-jft:score-proof:v2:'||payload,'UTF8')),'hex');
  insert into ikigai_jft_scores.exam_keys values(test->>'id',answers,sections,counts,sha256(convert_to(proof,'UTF8')));
  insert into ikigai_jft_scores.packages(exam_id,title,source,minutes,payload_text,created_by)
  values(test->>'id',test->>'title',package_source,(test->>'minutes')::int,payload,auth.uid());
  if test->'teacherControlled'='true'::jsonb then
   insert into ikigai_jft_scores.exam_access(exam_id,is_open,updated_by) values(test->>'id',false,auth.uid());
  end if;
  result:=result||jsonb_build_array(entry);
 end loop;
 return result;
end;$function$;
CREATE OR REPLACE FUNCTION ikigai_jft_scores.package(p_exam_id text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare payload text;
begin
 if not ikigai_jft_scores.can_read_packages() then raise insufficient_privilege using message='Cần đăng nhập tài khoản học viên hoặc giáo viên.'; end if;
 if not ikigai_jft_scores.can_enter_exam(p_exam_id) then raise insufficient_privilege using message='Giáo viên chưa mở đề này. Vui lòng chờ giáo viên mở đề.';end if;
 select payload_text into payload from ikigai_jft_scores.packages where exam_id=p_exam_id;
 if not found then raise invalid_parameter_value using message='Không tìm thấy đề.'; end if;
 return payload;
end;$function$;
CREATE OR REPLACE FUNCTION ikigai_jft_scores.text_get(p_exam_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare current_hash text;
begin
 if not ikigai_jft_scores.can_read_packages() then raise insufficient_privilege using message='Cần đăng nhập IKIGAI để xem đề.'; end if;
 if not ikigai_jft_scores.can_enter_exam(p_exam_id) then raise insufficient_privilege using message='Giáo viên chưa mở đề này. Vui lòng chờ giáo viên mở đề.';end if;
 select md5(payload_text) into current_hash from ikigai_jft_scores.packages where exam_id=p_exam_id;
 if exists(select 1 from ikigai_jft_scores.text_overlays where exam_id=p_exam_id and source_hash is distinct from current_hash) then
  raise serialization_failure using message='Bản chữ của đề cần được đối chiếu lại. Vui lòng liên hệ giáo viên.';
 end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('number',question_number,'fields',fields,'revision',revision) order by question_number),'[]'::jsonb) from ikigai_jft_scores.text_overlays where exam_id=p_exam_id);
end;$function$;
notify pgrst,'reload schema';
commit;
