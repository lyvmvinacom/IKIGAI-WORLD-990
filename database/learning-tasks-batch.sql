-- Atomic batch assignment; existing completion and wallet rules unchanged.
create or replace function public.ikigai_tasks_batch(p_student_id uuid,p_due_at timestamptz,p_tasks jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t record; c record; added integer:=0; skipped integer:=0;
begin
 if not ikigai_tasks_private.teacher() then raise insufficient_privilege using message='Teacher required';end if;
 if p_student_id is null then raise exception 'Chọn một học viên';end if;
 if jsonb_typeof(p_tasks) is distinct from 'array' or coalesce(jsonb_array_length(p_tasks),0) not between 1 and 200 then raise exception 'Chọn từ 1 đến 200 bài';end if;
 if not exists(select 1 from public.ikigai_world_profiles p join auth.users u on u.id=p.user_id where p.user_id=p_student_id and p.role='student' and not coalesce(u.is_anonymous,false)) then raise exception 'Học viên không hợp lệ';end if;
 perform pg_advisory_xact_lock(hashtextextended('ikigai-task-batch:'||p_student_id::text,0));
 for t in select * from jsonb_to_recordset(p_tasks) as i(room text,source text,lesson_key text) loop
  select * into c from public.ikigai_tasks_catalog() x where x.room=t.room and x.source=t.source and x.lesson_key=t.lesson_key limit 1;
  if not found then raise exception 'Bài học không tồn tại trong danh mục';end if;
  if exists(select 1 from ikigai_tasks_private.assignments a where a.active and a.student_id=p_student_id and a.source=t.source and a.lesson_key=t.lesson_key and a.due_at is not distinct from p_due_at) then skipped:=skipped+1;
  else
   perform public.ikigai_tasks_save(null,c.room,c.source,c.lesson_key,left(c.category||' · '||c.title,120),p_due_at,p_student_id);
   added:=added+1;
  end if;
 end loop;
 return jsonb_build_object('added',added,'skipped',skipped);
end$$;
revoke all on function public.ikigai_tasks_batch(uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.ikigai_tasks_batch(uuid,timestamptz,jsonb) to authenticated;
