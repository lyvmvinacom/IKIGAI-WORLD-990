-- Display text supports {漢字|かんじ} ruby and [[underline]]; no HTML accepted by the renderer.
create or replace function public.ikigai_n4_edit(p_exam text,p_section integer,p_index integer,p_before jsonb,p_question jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare e jsonb;q jsonb;updated jsonb;begin
 perform ikigai_n4_private.teacher_id();select payload into e from ikigai_n4_private.exams where id=p_exam for update;
 if p_section is null or p_section not between 0 and 2 or p_index is null or p_index<0 or p_index>=jsonb_array_length(e->'sections'->p_section->'questions') then raise exception 'Câu hỏi không hợp lệ';end if;
 q:=e->'sections'->p_section->'questions'->p_index;if q is distinct from p_before then raise exception 'Câu hỏi đã thay đổi. Hãy mở lại đề.';end if;
 if jsonb_typeof(p_question->'answer') is distinct from 'number' or (p_question->>'answer')::numeric<>trunc((p_question->>'answer')::numeric) or (p_question->>'answer')::int<0 or (p_question->>'answer')::int>=(q->>'options')::int or length(coalesce(p_question->>'prompt',''))>10000 or length(coalesce(p_question->>'explanation',''))>20000 or length(coalesce(p_question->>'contextText',''))>20000 then raise exception 'Nội dung không hợp lệ';end if;
 if jsonb_typeof(p_question->'optionTexts') is distinct from 'array' or jsonb_array_length(p_question->'optionTexts')<>(q->>'options')::int then raise exception 'Cần đủ lựa chọn';end if;
 if exists(select 1 from jsonb_array_elements(p_question->'optionTexts') v where jsonb_typeof(v)<>'string' or length(v#>>'{}')>2000) then raise exception 'Lựa chọn không hợp lệ';end if;
 if coalesce((p_question->>'hideImage')::boolean,false) and (length(trim(p_question->>'prompt'))=0 or exists(select 1 from jsonb_array_elements_text(p_question->'optionTexts') v where length(trim(v))=0)) then raise exception 'Cần đủ câu hỏi và các lựa chọn khi ẩn hình nguồn';end if;
 updated:=q||jsonb_build_object('hideImage',coalesce((p_question->>'hideImage')::boolean,false),'answer',p_question->'answer','prompt',coalesce(p_question->>'prompt',''),'explanation',coalesce(p_question->>'explanation',''),'optionTexts',p_question->'optionTexts');
 if q ? 'contextText' then if jsonb_typeof(p_question->'contextText') is distinct from 'string' or length(trim(p_question->>'contextText'))=0 then raise exception 'Cần giữ đầy đủ đoạn đọc';end if;updated:=updated||jsonb_build_object('contextText',p_question->>'contextText');end if;
 update ikigai_n4_private.exams set payload=jsonb_set(e,array['sections',p_section::text,'questions',p_index::text],updated),revision=revision+1 where id=p_exam;return updated;end$$;

revoke all on function public.ikigai_n4_edit(text,integer,integer,jsonb,jsonb) from public,anon;
grant execute on function public.ikigai_n4_edit(text,integer,integer,jsonb,jsonb) to authenticated;
