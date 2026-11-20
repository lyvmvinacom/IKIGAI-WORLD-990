-- Card labels are stored separately from the signed exam payload and grading key.
create table ikigai_jft_scores.exam_details (
 exam_id text primary key references ikigai_jft_scores.exam_keys(exam_id) on delete cascade,
 title text not null check(char_length(title) between 1 and 160),
 description text not null check(char_length(description)<=500),
 revision bigint not null default 1 check(revision>0),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table ikigai_jft_scores.exam_details enable row level security;
revoke all on ikigai_jft_scores.exam_details from public,anon,authenticated;

create function ikigai_jft_scores.details_put(p_exam_id text,p_title text,p_description text,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved ikigai_jft_scores.exam_details; expected bigint; clean_title text; clean_description text;
begin
 if not ikigai_jft_scores.can_import_packages() then raise insufficient_privilege using message='Chỉ giáo viên được sửa tiêu đề và mô tả đề.';end if;
 clean_title:=btrim(regexp_replace(p_title,E'[\r\n\t]+',' ','g'));
 clean_description:=btrim(replace(p_description,E'\r\n',E'\n'));
 if clean_title is null or char_length(clean_title) not between 1 and 160 or clean_description is null or char_length(clean_description)>500 or p_expected_revision is null or p_expected_revision<0 then
  raise invalid_parameter_value using message='Tiêu đề phải có từ 1–160 ký tự; mô tả tối đa 500 ký tự.';
 end if;
 -- Lock the stable parent so concurrent first edits cannot both claim revision zero.
 perform 1 from ikigai_jft_scores.exam_keys where exam_id=p_exam_id for update;
 if not found then raise invalid_parameter_value using message='Không tìm thấy đề.';end if;
 select * into saved from ikigai_jft_scores.exam_details where exam_id=p_exam_id;
 expected:=coalesce(saved.revision,0);
 if expected<>p_expected_revision then raise serialization_failure using message='Tiêu đề hoặc mô tả đã được sửa ở nơi khác. Hãy đóng rồi mở lại cửa sổ sửa để cập nhật.';end if;
 insert into ikigai_jft_scores.exam_details(exam_id,title,description,revision,updated_by)
 values(p_exam_id,clean_title,clean_description,expected+1,auth.uid())
 on conflict(exam_id) do update set title=excluded.title,description=excluded.description,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now()
 returning * into saved;
 return jsonb_build_object('id',saved.exam_id,'title',saved.title,'source',saved.description,'metadataRevision',saved.revision);
end;$$;

create function public.ikigai_jft_details_put(p_exam_id text,p_title text,p_description text,p_expected_revision bigint)
returns jsonb language sql set search_path='' as $$select ikigai_jft_scores.details_put(p_exam_id,p_title,p_description,p_expected_revision);$$;
revoke all on function ikigai_jft_scores.details_put(text,text,text,bigint),public.ikigai_jft_details_put(text,text,text,bigint) from public,anon;
grant execute on function ikigai_jft_scores.details_put(text,text,text,bigint),public.ikigai_jft_details_put(text,text,text,bigint) to authenticated;

create or replace function ikigai_jft_scores.catalog()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not ikigai_jft_scores.can_read_packages() then raise insufficient_privilege using message='Cần đăng nhập tài khoản học viên hoặc giáo viên.';end if;
 return (with all_exams as (
  select exam_id,title,source,minutes,created_at from ikigai_jft_scores.packages
  union all
  select k.exam_id,'Đề '||right(k.exam_id,2),'SoreNihongo · Vol. 1 · IKIGAI EDUCATION',60,'epoch'::timestamptz
  from ikigai_jft_scores.exam_keys k where k.exam_id~'^sore-vol1-(0[1-9]|10)$'
  and not exists(select 1 from ikigai_jft_scores.packages p where p.exam_id=k.exam_id)
 ) select coalesce(jsonb_agg(jsonb_build_object(
  'id',p.exam_id,'title',coalesce(d.title,p.title),'source',coalesce(d.description,p.source),
  'metadataRevision',coalesce(d.revision,0),'minutes',p.minutes,'questionCount',50,
  'access',jsonb_build_object('controlled',a.exam_id is not null,'open',coalesce(a.is_open,true),'revision',coalesce(a.revision,0))
 ) order by p.created_at,p.exam_id),'[]'::jsonb)
 from all_exams p
 left join ikigai_jft_scores.exam_access a on a.exam_id=p.exam_id
 left join ikigai_jft_scores.exam_details d on d.exam_id=p.exam_id);
end;$$;

comment on table ikigai_jft_scores.exam_details is 'Teacher-editable catalog labels; never modifies payload_text, media hashes, scoring proofs, exam IDs or student results.';
