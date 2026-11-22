create or replace function public.ikigai_n5_rename_title(p_exam text,p_title text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare normalized text;
begin
 perform ikigai_n5_private.teacher_id();
 if p_exam is null or p_exam not in ('n5-de01','n5-de02') then
  raise exception 'Không tìm thấy đề N5';
 end if;
 normalized:=btrim(p_title);
 if normalized is null or char_length(normalized) not between 1 and 120 then
  raise exception 'Tiêu đề phải có từ 1 đến 120 ký tự';
 end if;
 update ikigai_n5_private.exams
 set payload=jsonb_set(payload,'{title}',to_jsonb(normalized),true),
     revision=revision+1
 where id=p_exam;
 if not found then raise exception 'Không tìm thấy đề N5'; end if;
 return jsonb_build_object('id',p_exam,'title',normalized);
end
$$;
revoke all on function public.ikigai_n5_rename_title(text,text) from public, anon, authenticated;
grant execute on function public.ikigai_n5_rename_title(text,text) to authenticated;
