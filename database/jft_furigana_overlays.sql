-- Teacher-managed display annotations; source payloads and score proofs remain unchanged.
begin;
create table ikigai_jft_scores.furigana_overlays (
 exam_id text not null references ikigai_jft_scores.exam_keys(exam_id),
 question_number integer not null check(question_number between 1 and 50),
 fields jsonb not null check(jsonb_typeof(fields)='object'),
 revision bigint not null default 1 check(revision>0),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key(exam_id,question_number)
);
alter table ikigai_jft_scores.furigana_overlays enable row level security;
revoke all on ikigai_jft_scores.furigana_overlays from public,anon,authenticated;
create function ikigai_jft_scores.furigana_get(p_exam_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not ikigai_jft_scores.can_read_packages() then raise insufficient_privilege using message='Cần đăng nhập IKIGAI để xem đề.'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('number',question_number,'fields',fields,'revision',revision) order by question_number),'[]'::jsonb) from ikigai_jft_scores.furigana_overlays where exam_id=p_exam_id);
end;$$;
create function ikigai_jft_scores.furigana_put(p_exam_id text,p_question_number integer,p_fields jsonb,p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare k text; v jsonb; span jsonb; source_q jsonb; source_text text; start_pos integer; end_pos integer; previous_end integer; old_revision bigint; result_revision bigint;
begin
 if not ikigai_jft_scores.can_import_packages() then raise insufficient_privilege using message='Chỉ giáo viên được sửa furigana.'; end if;
 if p_exam_id is null or p_question_number is null or p_question_number not between 1 and 50 or not exists(select 1 from ikigai_jft_scores.exam_keys where exam_id=p_exam_id) then raise invalid_parameter_value using message='Không tìm thấy đề hoặc câu hỏi.'; end if;
 if p_fields is null or jsonb_typeof(p_fields)<>'object' or octet_length(p_fields::text)>60000 or p_expected_revision is null or p_expected_revision<0 then raise invalid_parameter_value using message='Dữ liệu furigana không hợp lệ.'; end if;
 select payload_text::jsonb->'tests'->0->'questions'->(p_question_number-1) into source_q from ikigai_jft_scores.packages where exam_id=p_exam_id;
 for k,v in select key,value from jsonb_each(p_fields) loop
  if k !~ '^(prompt|passage|instruction|options\.[0-3])$' or jsonb_typeof(v)<>'object' or jsonb_typeof(v->'text') is distinct from 'string' or length(v->>'text') not between 1 and 8000 or jsonb_typeof(v->'spans') is distinct from 'array' then raise invalid_parameter_value using message='Vị trí furigana không hợp lệ.'; end if;
  if jsonb_array_length(v->'spans') not between 1 and 100 then raise invalid_parameter_value using message='Số lượng phiên âm không hợp lệ.'; end if;
  if source_q is not null then
   source_text:=case when k like 'options.%' then source_q->'options'->>((split_part(k,'.',2))::integer) else source_q->>k end;
   if source_text is distinct from (v->>'text') then raise serialization_failure using message='Nội dung câu đã thay đổi. Hãy mở lại đề để sửa furigana.'; end if;
  end if;
  previous_end:=0;
  for span in select value from jsonb_array_elements(v->'spans') loop
   if jsonb_typeof(span)<>'object' or jsonb_typeof(span->'start') is distinct from 'number' or jsonb_typeof(span->'end') is distinct from 'number' or (span->>'start') !~ '^[0-9]{1,5}$' or (span->>'end') !~ '^[0-9]{1,5}$' or jsonb_typeof(span->'reading') is distinct from 'string' or length(span->>'reading') not between 1 and 100 or (span->>'reading') !~ '^[ぁ-ゖァ-ヺー・ 　]+$' or btrim(span->>'reading',' 　')='' then raise invalid_parameter_value using message='Phiên âm cần là hiragana hoặc katakana.'; end if;
   start_pos:=(span->>'start')::integer;end_pos:=(span->>'end')::integer;
   if start_pos<previous_end or end_pos<=start_pos or end_pos>length(v->>'text') then raise invalid_parameter_value using message='Vị trí phiên âm bị trùng hoặc vượt nội dung.'; end if;
   previous_end:=end_pos;
  end loop;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended('ikigai-jft-ruby:'||p_exam_id||':'||p_question_number::text,0));
 select revision into old_revision from ikigai_jft_scores.furigana_overlays where exam_id=p_exam_id and question_number=p_question_number;
 if coalesce(old_revision,0)<>p_expected_revision then raise serialization_failure using message='Furigana đã được cập nhật ở nơi khác. Hãy mở lại đề trước khi sửa tiếp.'; end if;
 insert into ikigai_jft_scores.furigana_overlays(exam_id,question_number,fields,updated_by) values(p_exam_id,p_question_number,p_fields,auth.uid())
 on conflict(exam_id,question_number) do update set fields=excluded.fields,revision=ikigai_jft_scores.furigana_overlays.revision+1,updated_by=excluded.updated_by,updated_at=now()
 returning revision into result_revision;
 return jsonb_build_object('number',p_question_number,'fields',p_fields,'revision',result_revision);
end;$$;
create function public.ikigai_jft_furigana_get(p_exam_id text) returns jsonb language sql security invoker set search_path='' as $$select ikigai_jft_scores.furigana_get(p_exam_id);$$;
create function public.ikigai_jft_furigana_put(p_exam_id text,p_question_number integer,p_fields jsonb,p_expected_revision bigint) returns jsonb language sql security invoker set search_path='' as $$select ikigai_jft_scores.furigana_put(p_exam_id,p_question_number,p_fields,p_expected_revision);$$;
revoke all on function ikigai_jft_scores.furigana_get(text),ikigai_jft_scores.furigana_put(text,integer,jsonb,bigint),public.ikigai_jft_furigana_get(text),public.ikigai_jft_furigana_put(text,integer,jsonb,bigint) from public,anon;
grant execute on function ikigai_jft_scores.furigana_get(text),ikigai_jft_scores.furigana_put(text,integer,jsonb,bigint),public.ikigai_jft_furigana_get(text),public.ikigai_jft_furigana_put(text,integer,jsonb,bigint) to authenticated;
notify pgrst,'reload schema';
commit;
