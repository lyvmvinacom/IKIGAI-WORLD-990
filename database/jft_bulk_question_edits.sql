create or replace function ikigai_jft_scores.question_edits_put(p_exam_id text,p_question_number integer,p_fields jsonb,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 k ikigai_jft_scores.exam_keys%rowtype;
 latest integer;
 current_revision integer;
 edit ikigai_jft_scores.question_edits%rowtype;
 f text;
begin
 if not ikigai_jft_scores.can_import_packages() then raise insufficient_privilege using message='Chỉ giáo viên được sửa câu hỏi.'; end if;
 select * into k from ikigai_jft_scores.exam_keys where exam_id=p_exam_id for update;
 if not found or p_question_number is null or p_question_number not between 1 and cardinality(k.answers)
 then raise invalid_parameter_value using message='Không tìm thấy câu hỏi.'; end if;
 select coalesce(max(revision),0),coalesce(max(revision) filter(where question_number=p_question_number),0)
 into latest,current_revision from ikigai_jft_scores.question_edits where exam_id=p_exam_id;
 if p_expected_revision is distinct from current_revision then raise serialization_failure using message='Câu này vừa được cập nhật. Hãy mở lại đề.'; end if;
 if jsonb_typeof(p_fields) is distinct from 'object' or p_fields='{}' or octet_length(p_fields::text)>4000000
 then raise invalid_parameter_value using message='Dữ liệu chỉnh sửa không hợp lệ.'; end if;
 for f in select jsonb_object_keys(p_fields) loop
  if not coalesce((case f
   when 'instruction' then jsonb_typeof(p_fields->f)='string' and length(trim(p_fields->>f)) between 1 and 500
   when 'prompt' then jsonb_typeof(p_fields->f)='string' and length(p_fields->>f)<=3000
   when 'passage' then jsonb_typeof(p_fields->f)='string' and length(p_fields->>f)<=8000
   when 'underlined' then p_fields->f='null' or (jsonb_typeof(p_fields->f)='string' and length(p_fields->>f) between 1 and 200)
   when 'explanation' then jsonb_typeof(p_fields->f)='string' and length(trim(p_fields->>f)) between 1 and 5000
   when 'correct' then jsonb_typeof(p_fields->f)='number' and (p_fields->>f) ~ '^[0-3]$' and (p_fields->>f)::integer<k.option_counts[p_question_number]
   when 'options' then case when jsonb_typeof(p_fields->f)='array' then jsonb_array_length(p_fields->f)=k.option_counts[p_question_number]
       and not exists(select 1 from jsonb_array_elements(p_fields->f) v where jsonb_typeof(v)<>'string' or length(trim(v#>>'{}')) not between 1 and 2500) else false end
   when 'figure' then p_fields->f='null' or (jsonb_typeof(p_fields->f)='string' and length(p_fields->>f)<=2800000 and (p_fields->>f) ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$')
   when 'sourceView' then p_fields->f='null' or (jsonb_typeof(p_fields->f)='string' and length(p_fields->>f)<=2800000 and (p_fields->>f) ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$')
   when 'listenText' then k.sections[p_question_number]=2 and case when jsonb_typeof(p_fields#>'{listenText,turns}')='array' then
      jsonb_typeof(p_fields#>'{listenText,question}')='string' and length(trim(p_fields#>>'{listenText,question}')) between 1 and 1500
      and jsonb_typeof(p_fields#>'{listenText,questionVi}')='string' and length(trim(p_fields#>>'{listenText,questionVi}')) between 1 and 1500
      and jsonb_array_length(p_fields#>'{listenText,turns}') between 1 and 20 and not exists(
       select 1 from jsonb_array_elements(p_fields#>'{listenText,turns}') as turn
       where not case when jsonb_typeof(turn)='array' then
        jsonb_array_length(turn)=2 and coalesce(turn->>0,'') in ('Nam','Nữ','A','B') and jsonb_typeof(turn->1)='string'
        and length(trim(turn->>1)) between 1 and 5000 else false end
      ) else false end
   when 'mp3' then k.sections[p_question_number]=2 and jsonb_typeof(p_fields->f)='string' and length(p_fields->>f)<=850000
       and length(p_fields->>f)%4=0 and (p_fields->>f) ~ '^[A-Za-z0-9+/]+={0,2}$'
   when 'furigana' then jsonb_typeof(p_fields->f)='object' and octet_length((p_fields->f)::text)<=100000
   else false end),false) then raise invalid_parameter_value using message='Trường không hợp lệ: '||f; end if;
 end loop;
 insert into ikigai_jft_scores.question_edits(exam_id,revision,question_number,fields,proof,edited_by)
 values(p_exam_id,latest+1,p_question_number,p_fields,replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),auth.uid()) returning * into edit;
 return jsonb_build_object('revision',edit.revision,'number',edit.question_number);
end;
$$;


create function ikigai_jft_scores.question_edits_apply(p_exam_id text,p_expected_revision integer,p_changes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 latest integer;
 base_revision integer;
 item jsonb;
 saved jsonb;
 question_number integer;
 seen integer[]:='{}';
begin
 if not ikigai_jft_scores.can_import_packages() then raise insufficient_privilege using message='Chỉ giáo viên được cập nhật đề.'; end if;
 if jsonb_typeof(p_changes) is distinct from 'array' or octet_length(p_changes::text)>33554432 then
  raise invalid_parameter_value using message='Danh sách cập nhật không hợp lệ hoặc vượt 32 MB.';
 end if;
 if jsonb_array_length(p_changes) not between 1 and 50 then raise invalid_parameter_value using message='Cần chọn từ 1 đến 50 câu để cập nhật.'; end if;
 perform 1 from ikigai_jft_scores.exam_keys where exam_id=p_exam_id for update;
 if not found then raise invalid_parameter_value using message='Không tìm thấy mã đề hiện có.'; end if;
 select coalesce(max(revision),0) into latest from ikigai_jft_scores.question_edits where exam_id=p_exam_id;
 if latest is distinct from p_expected_revision then
  raise serialization_failure using message='Đề đã thay đổi kể từ lúc xem trước. Hãy bấm Kiểm tra và xem trước lại.';
 end if;
 for item in select value from jsonb_array_elements(p_changes) loop
  if jsonb_typeof(item->'number') is distinct from 'number' or coalesce(item->>'number','') !~ '^([1-9]|[1-4][0-9]|50)$' then
   raise invalid_parameter_value using message='Số câu không hợp lệ.';
  end if;
  question_number:=(item->>'number')::integer;
  if question_number=any(seen) then raise invalid_parameter_value using message='Một câu xuất hiện nhiều lần.'; end if;
  seen:=array_append(seen,question_number);
  select coalesce(max(e.revision),0) into base_revision from ikigai_jft_scores.question_edits e
   where e.exam_id=p_exam_id and e.question_number=(item->>'number')::integer;
  saved:=ikigai_jft_scores.question_edits_put(p_exam_id,question_number,item->'fields',base_revision);
 end loop;
 return jsonb_build_object('id',p_exam_id,'revision',saved->'revision','count',cardinality(seen));
end;
$$;

create function public.ikigai_jft_question_edits_apply(p_exam_id text,p_expected_revision integer,p_changes jsonb)
returns jsonb language sql set search_path='' as $$
 select ikigai_jft_scores.question_edits_apply(p_exam_id,p_expected_revision,p_changes);
$$;
revoke all on function ikigai_jft_scores.question_edits_apply(text,integer,jsonb),
 public.ikigai_jft_question_edits_apply(text,integer,jsonb) from public,anon;
grant execute on function ikigai_jft_scores.question_edits_apply(text,integer,jsonb),
 public.ikigai_jft_question_edits_apply(text,integer,jsonb) to authenticated;
