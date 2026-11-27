begin;

create or replace function private.ikigai_jlpt_history_skills(p_result jsonb, p_listening jsonb, p_answers jsonb)
returns jsonb
language sql immutable set search_path = ''
as $$
  select coalesce(p_result->'references', '[]'::jsonb) ||
    (select jsonb_build_array(jsonb_build_object(
      'group', 'listening',
      'total', count(*),
      'correct', count(*) filter (where (p_answers->>(q.ordinality::integer - 1))::integer = (q.value->>'answer')::integer)
    ))
    from jsonb_array_elements(p_listening) with ordinality q);
$$;

revoke all on function private.ikigai_jlpt_history_skills(jsonb, jsonb, jsonb) from public, anon, authenticated;

create or replace function private.ikigai_teacher_exam_history(
  p_level text, p_student uuid, p_exam text, p_offset integer
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  students jsonb;
  exams jsonb;
  history jsonb;
begin
  if not private.ikigai_is_teacher() or not ikigai_jft_scores.can_import_packages() then
    raise insufficient_privilege using message = 'Chỉ giáo viên được xem lịch sử thi của học viên.';
  end if;
  if p_level is null or p_level not in ('n5', 'n4', 'jft') or p_offset is null or p_offset < 0 then
    raise invalid_parameter_value using message = 'Bộ lọc lịch sử thi không hợp lệ.';
  end if;

  if p_offset = 0 then
    select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by lower(s.name), s.id), '[]'::jsonb)
    into students
    from (
      select u.id, left(coalesce(nullif(trim(p.nickname), ''), nullif(trim(u.raw_user_meta_data->>'nickname'), ''), 'Học viên'), 80) as name
      from auth.users u
      left join public.ikigai_world_profiles p on p.user_id = u.id
      left join private.ikigai_registrations r on r.user_id = u.id
      where u.deleted_at is null and not coalesce(u.is_anonymous, false)
        and u.raw_app_meta_data->>'role' is distinct from 'teacher'
        and (r.status = 'approved'
          or (p_level = 'n5' and exists (select 1 from ikigai_n5_private.attempts a where a.user_id = u.id and a.result is not null))
          or (p_level = 'n4' and exists (select 1 from ikigai_n4_private.attempts a where a.user_id = u.id and a.result is not null))
          or (p_level = 'jft' and exists (select 1 from ikigai_jft_scores.results a where a.user_id = u.id)))
    ) s;

    select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title) order by e.title, e.id), '[]'::jsonb)
    into exams
    from (
      select id, coalesce(payload->>'title', id) as title from ikigai_n5_private.exams where p_level = 'n5'
      union all
      select id, coalesce(payload->>'title', id) from ikigai_n4_private.exams where p_level = 'n4'
      union all
      select k.exam_id, coalesce(d.title, p.title, k.exam_id)
      from ikigai_jft_scores.exam_keys k
      left join ikigai_jft_scores.packages p using (exam_id)
      left join ikigai_jft_scores.exam_details d using (exam_id)
      where p_level = 'jft'
    ) e;
  end if;

  with attempts as (
    select a.id, a.user_id, a.exam_id, a.result->>'title' as title,
      coalesce((a.result->>'created_at')::timestamptz, a.created_at) as submitted_at,
      (a.result->>'total')::integer as score, (a.result->>'passed')::boolean as reached_target,
      a.result, a.snapshot, a.answers, null::jsonb as jft_sections
    from ikigai_n5_private.attempts a
    where p_level = 'n5' and a.result is not null
      and (p_student is null or a.user_id = p_student) and (p_exam is null or a.exam_id = p_exam)
    union all
    select a.id, a.user_id, a.exam_id, a.result->>'title',
      coalesce((a.result->>'created_at')::timestamptz, a.created_at),
      (a.result->>'total')::integer, (a.result->>'passed')::boolean,
      a.result, a.snapshot, a.answers, null::jsonb
    from ikigai_n4_private.attempts a
    where p_level = 'n4' and a.result is not null
      and (p_student is null or a.user_id = p_student) and (p_exam is null or a.exam_id = p_exam)
    union all
    select a.attempt_id, a.user_id, a.exam_id, coalesce(d.title, p.title, a.exam_id),
      a.submitted_at, a.score, a.score >= 200, null::jsonb, null::jsonb, null::jsonb, a.sections
    from ikigai_jft_scores.results a
    left join ikigai_jft_scores.packages p using (exam_id)
    left join ikigai_jft_scores.exam_details d using (exam_id)
    where p_level = 'jft'
      and (p_student is null or a.user_id = p_student) and (p_exam is null or a.exam_id = p_exam)
  ), eligible as (
    select a.*, coalesce(nullif(trim(p.nickname), ''), nullif(a.result->>'nickname', ''),
      nullif(trim(u.raw_user_meta_data->>'nickname'), ''), 'Học viên') as student_name
    from attempts a
    join auth.users u on u.id = a.user_id
    left join public.ikigai_world_profiles p on p.user_id = a.user_id
    where u.deleted_at is null and not coalesce(u.is_anonymous, false)
      and u.raw_app_meta_data->>'role' is distinct from 'teacher'
  ), page as materialized (
    select * from eligible order by submitted_at desc, user_id, id desc limit 25 offset p_offset
  ), reports as (
    select id, user_id, student_name, exam_id, title, submitted_at, score, reached_target,
      case when p_level = 'jft' then (
        select coalesce(jsonb_agg(s.value || jsonb_build_object('group',
          (array['characters', 'conversation', 'listening', 'reading'])[s.ordinality::integer]) order by s.ordinality), '[]'::jsonb)
        from jsonb_array_elements(jft_sections) with ordinality s
      ) else private.ikigai_jlpt_history_skills(result, snapshot->'sections'->2->'questions', answers->2) end as skills
    from page
  )
  select jsonb_build_object('students', students, 'exams', exams,
    'count', (select count(*) from eligible),
    'rows', coalesce((select jsonb_agg(to_jsonb(reports) order by submitted_at desc, user_id, id desc) from reports), '[]'::jsonb))
  into history;
  return history;
end;
$$;

revoke all on function private.ikigai_teacher_exam_history(text, uuid, text, integer) from public, anon, authenticated;
grant execute on function private.ikigai_teacher_exam_history(text, uuid, text, integer) to authenticated;

create or replace function public.ikigai_teacher_exam_history(
  p_level text, p_student uuid default null, p_exam text default null, p_offset integer default 0
) returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select private.ikigai_teacher_exam_history(p_level, p_student, p_exam, p_offset);
$$;

revoke all on function public.ikigai_teacher_exam_history(text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.ikigai_teacher_exam_history(text, uuid, text, integer) to authenticated;

commit;
