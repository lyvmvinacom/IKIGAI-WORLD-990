
create table ikigai_jft_scores.question_edits (
 exam_id text not null references ikigai_jft_scores.exam_keys(exam_id),
 revision integer not null,
 question_number integer not null check (question_number between 1 and 50),
 fields jsonb not null,
 proof text not null unique,
 edited_by uuid not null,
 edited_at timestamptz not null default now(),
 primary key (exam_id,revision)
);
alter table ikigai_jft_scores.question_edits enable row level security;
revoke all on ikigai_jft_scores.question_edits from public,anon,authenticated;

create function ikigai_jft_scores.question_edits_get(p_exam_id text,p_revision integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare version integer;
begin
 if not ikigai_jft_scores.can_read_packages() then raise insufficient_privilege; end if;
 select coalesce(max(revision),0) into version from ikigai_jft_scores.question_edits where exam_id=p_exam_id;
 version:=coalesce(p_revision,version);
 if version<0 or (version>0 and not exists(select 1 from ikigai_jft_scores.question_edits where exam_id=p_exam_id and revision=version))
 then raise invalid_parameter_value using message='Phiên bản đề không hợp lệ.'; end if;
 return jsonb_build_object('revision',version,
 'proof',(select proof from ikigai_jft_scores.question_edits where exam_id=p_exam_id and revision=version),
 'questions',coalesce((select jsonb_agg(jsonb_build_object('number',question_number,'fields',fields,'revision',revision) order by revision)
 from ikigai_jft_scores.question_edits where exam_id=p_exam_id and revision<=version),'[]'::jsonb));
end;
$$;

create function ikigai_jft_scores.question_edits_put(p_exam_id text,p_question_number integer,p_fields jsonb,p_expected_revision integer)
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
  if not (case f
   when 'instruction' then jsonb_typeof(p_fields->f)='string' and length(trim(p_fields->>f)) between 1 and 500
   when 'prompt' then jsonb_typeof(p_fields->f)='string' and length(p_fields->>f)<=3000
   when 'passage' then jsonb_typeof(p_fields->f)='string' and length(p_fields->>f)<=8000
   when 'underlined' then p_fields->f='null' or (jsonb_typeof(p_fields->f)='string' and length(p_fields->>f) between 1 and 200)
   when 'explanation' then jsonb_typeof(p_fields->f)='string' and length(trim(p_fields->>f)) between 1 and 5000
   when 'correct' then jsonb_typeof(p_fields->f)='number' and (p_fields->>f) ~ '^[0-3]$' and (p_fields->>f)::integer<k.option_counts[p_question_number]
   when 'options' then case when jsonb_typeof(p_fields->f)='array' then jsonb_array_length(p_fields->f)=k.option_counts[p_question_number]
       and not exists(select 1 from jsonb_array_elements(p_fields->f) v where jsonb_typeof(v)<>'string' or length(trim(v#>>'{}')) not between 1 and 2500) else false end
   when 'figure' then p_fields->f='null' or (jsonb_typeof(p_fields->f)='string' and length(p_fields->>f)<=2800000 and (p_fields->>f) ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$')
   when 'mp3' then k.sections[p_question_number]=2 and jsonb_typeof(p_fields->f)='string' and length(p_fields->>f)<=850000
       and length(p_fields->>f)%4=0 and (p_fields->>f) ~ '^[A-Za-z0-9+/]+={0,2}$'
   when 'furigana' then jsonb_typeof(p_fields->f)='object' and octet_length((p_fields->f)::text)<=100000
   else false end) then raise invalid_parameter_value using message='Trường không hợp lệ: '||f; end if;
 end loop;
 insert into ikigai_jft_scores.question_edits(exam_id,revision,question_number,fields,proof,edited_by)
 values(p_exam_id,latest+1,p_question_number,p_fields,replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),auth.uid()) returning * into edit;
 return jsonb_build_object('revision',edit.revision,'number',edit.question_number);
end;
$$;

create function public.ikigai_jft_question_edits_get(p_exam_id text,p_revision integer default null)
returns jsonb language sql stable set search_path='' as $$select ikigai_jft_scores.question_edits_get(p_exam_id,p_revision);$$;
create function public.ikigai_jft_question_edits_put(p_exam_id text,p_question_number integer,p_fields jsonb,p_expected_revision integer)
returns jsonb language sql set search_path='' as $$select ikigai_jft_scores.question_edits_put(p_exam_id,p_question_number,p_fields,p_expected_revision);$$;
revoke all on function ikigai_jft_scores.question_edits_get(text,integer),ikigai_jft_scores.question_edits_put(text,integer,jsonb,integer),
 public.ikigai_jft_question_edits_get(text,integer),public.ikigai_jft_question_edits_put(text,integer,jsonb,integer) from public,anon;
grant execute on function ikigai_jft_scores.question_edits_get(text,integer),ikigai_jft_scores.question_edits_put(text,integer,jsonb,integer),
 public.ikigai_jft_question_edits_get(text,integer),public.ikigai_jft_question_edits_put(text,integer,jsonb,integer) to authenticated;
CREATE OR REPLACE FUNCTION ikigai_jft_scores.submit(p_account_id uuid, p_exam_id text, p_attempt_id uuid, p_answers integer[], p_class_proof text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  student uuid := ikigai_jft_scores.current_student();
  exam ikigai_jft_scores.exam_keys%rowtype;
  saved ikigai_jft_scores.results%rowtype;
  edit_revision integer;
  changed record;
  current_xp integer;
  already_earned integer;
  earned integer;
  correct integer;
  breakdown jsonb; receipt jsonb;
begin
  if student is null or student is distinct from p_account_id then
    raise insufficient_privilege using message = 'Student account required';
  end if;
  if p_attempt_id is null or array_ndims(p_answers) is distinct from 1
     or array_lower(p_answers, 1) is distinct from 1 or cardinality(p_answers) is distinct from 50 then
    raise invalid_parameter_value using message = 'Invalid JFT attempt';
  end if;

  select k.* into exam from ikigai_jft_scores.exam_keys as k where k.exam_id = p_exam_id;
  if not found then raise invalid_parameter_value using message = 'Unknown JFT exam'; end if;
  if p_class_proof is null or p_class_proof !~ '^[a-f0-9]{64}$' then
    raise insufficient_privilege using message = 'Class exam access required';
  end if;
  if pg_catalog.sha256(pg_catalog.convert_to(p_class_proof, 'UTF8')) <> exam.proof_hash then
    select e.revision into edit_revision from ikigai_jft_scores.question_edits e
      where e.exam_id=p_exam_id and e.proof=p_class_proof;
    if not found then raise insufficient_privilege using message = 'Class exam access required'; end if;
    for changed in
      select distinct on (e.question_number) e.question_number,(e.fields->>'correct')::integer as answer
      from ikigai_jft_scores.question_edits e where e.exam_id=p_exam_id and e.revision<=edit_revision and e.fields?'correct'
      order by e.question_number,e.revision desc
    loop
      exam.answers[changed.question_number]:=changed.answer;
    end loop;
  end if;
  if exists (
    select 1 from generate_series(1, 50) as q(n)
    where p_answers[q.n] < 0 or p_answers[q.n] >= exam.option_counts[q.n]
  ) then raise invalid_parameter_value using message = 'Invalid JFT answer'; end if;

  -- Serialize XP changes for one player, including concurrent retries and other game awards.
  insert into public.ikigai_world_profiles (user_id) values (student) on conflict (user_id) do nothing;
  select p.xp into current_xp from public.ikigai_world_profiles as p
    where p.user_id = student for update;

  select r.* into saved from ikigai_jft_scores.results as r
    where r.user_id = student and r.attempt_id = p_attempt_id;
  if found then
    if saved.exam_id <> p_exam_id then raise invalid_parameter_value using message = 'Attempt exam mismatch'; end if;
    return (to_jsonb(saved) - 'user_id') || jsonb_build_object('xp_total', current_xp);
  end if;

  select sum(b.correct)::integer,
         jsonb_agg(jsonb_build_object('correct', b.correct, 'total', b.total) order by b.section)
  into correct, breakdown
  from (
    select exam.sections[q.n] as section, count(*) as total,
           count(*) filter (where p_answers[q.n] = exam.answers[q.n]) as correct
    from generate_series(1, 50) as q(n)
    group by exam.sections[q.n]
  ) as b;

  select coalesce(sum(r.xp_awarded), 0)::integer into already_earned
  from ikigai_jft_scores.results as r
  where r.user_id = student and r.exam_id = p_exam_id;
  earned := 0;

  insert into ikigai_jft_scores.results
    (user_id, attempt_id, exam_id, correct_count, score, sections, xp_awarded)
  values
    (student, p_attempt_id, p_exam_id, correct, round(10 + 240.0 * correct / 50)::integer, breakdown, earned)
  returning * into saved;

  receipt:=ikigai_rewards_private.settle_v2(student,'jft_exam','exam:'||p_exam_id,p_attempt_id,correct,50,least(correct*10,200),200);
 earned:=coalesce((receipt->>'xp_awarded')::integer,0);
 current_xp:=coalesce((receipt->>'xp_total')::integer,current_xp);
 update ikigai_jft_scores.results set xp_awarded=earned where user_id=student and attempt_id=p_attempt_id returning * into saved;
 return (to_jsonb(saved) - 'user_id') || jsonb_build_object('xp_total', current_xp);
end;
$function$;
