-- Edit one question with optimistic concurrency; historical results and EXP stay unchanged.
create or replace function public.ikigai_jft_drill_edit(p_test_id text,p_question_id text,p_before jsonb,p_question jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare bank jsonb; oldq jsonb; newq jsonb; idx integer; r public.ikigai_room_questions; a integer;
begin
 if not exists(select 1 from auth.users u where u.id=auth.uid() and not coalesce(u.is_anonymous,false) and u.raw_app_meta_data->>'role'='teacher' and (u.banned_until is null or u.banned_until<=now())) then
  raise insufficient_privilege using message='Chỉ giáo viên được sửa câu hỏi.';
 end if;
 if jsonb_typeof(p_question->'prompt') is distinct from 'string' or length(trim(p_question->>'prompt')) not between 1 and 10000 or jsonb_typeof(p_question->'options') is distinct from 'array' or jsonb_array_length(p_question->'options')<>4 or jsonb_typeof(p_question->'accepted') is distinct from 'array' or jsonb_array_length(p_question->'accepted')>4 or length(coalesce(p_question->>'note',''))>20000 then raise exception 'Dữ liệu câu hỏi không hợp lệ';end if;
 if exists(select 1 from jsonb_array_elements(p_question->'options') v where jsonb_typeof(v)<>'string' or length(trim(v#>>'{}')) not between 1 and 2000) or exists(select 1 from jsonb_array_elements(p_question->'accepted') v where v::text not in ('0','1','2','3')) then raise exception 'Cần đủ 4 lựa chọn và đáp án hợp lệ';end if;
 select payload into bank from public.ikigai_jft_drill_sets where id=p_test_id for update;
 if found then
  select value,(ordinality-1)::integer into oldq,idx from jsonb_array_elements(bank->'questions') with ordinality where value->>'id'=p_question_id;
  if oldq is null then raise exception 'Không tìm thấy câu hỏi';end if;
  if oldq is distinct from p_before then raise exception 'Câu hỏi đã được người khác sửa. Hãy mở lại danh sách.';end if;
  newq:=oldq||jsonb_build_object('prompt',trim(p_question->>'prompt'),'options',p_question->'options','accepted',p_question->'accepted','note',coalesce(p_question->>'note',''));
  update public.ikigai_jft_drill_sets set payload=jsonb_set(bank,array['questions',idx::text],newq) where id=p_test_id;
 elsif p_test_id ~ '^excel-(kanji|vocabulary|hyogen)-[0-9]+-[0-9]+$' then
  select * into r from public.ikigai_room_questions where room='jft' and id=p_question_id and "group"=case split_part(p_test_id,'-',2) when 'hyogen' then 'grammar' else split_part(p_test_id,'-',2) end and lesson=split_part(p_test_id,'-',3)::int for update;
  if not found then raise exception 'Không tìm thấy câu hỏi';end if;
  oldq:=jsonb_build_object('id',r.id,'prompt',r.question,'options',r.options,'accepted',jsonb_build_array(strpos('ABCD',r.correct)-1),'note',r.explanation);
  if oldq is distinct from p_before then raise exception 'Câu hỏi đã được người khác sửa. Hãy mở lại danh sách.';end if;
  if jsonb_array_length(p_question->'accepted')<>1 then raise exception 'Câu nhập Excel cần chọn đúng một đáp án.';end if;
  a:=(p_question->'accepted'->>0)::integer;
  update public.ikigai_room_questions set question=trim(p_question->>'prompt'),options=array(select jsonb_array_elements_text(p_question->'options')),correct=substr('ABCD',a+1,1),explanation=coalesce(p_question->>'note','') where room='jft' and id=p_question_id;
  newq:=oldq||p_question;
 else raise exception 'Không tìm thấy đề';end if;
 return newq;
end;
$$;
revoke all on function public.ikigai_jft_drill_edit(text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.ikigai_jft_drill_edit(text,text,jsonb,jsonb) to authenticated;
