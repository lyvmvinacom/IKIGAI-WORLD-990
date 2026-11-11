create or replace function ikigai_jft_scores.import_packages(p_package_text text) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
  result:=result||jsonb_build_array(entry);
 end loop;
 return result;
end;$$;

-- PostgREST reads this bounded exception for the import RPC only.
alter function public.ikigai_jft_import(text) set statement_timeout='30s';
create index if not exists packages_created_by_idx on ikigai_jft_scores.packages(created_by);
notify pgrst, 'reload schema';
