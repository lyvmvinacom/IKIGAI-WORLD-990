-- Audio-only overlays: never update source payloads, answer keys, attempts, results or score proofs.
begin;
create table if not exists ikigai_jft_scores.audio_updates (
 exam_id text not null references ikigai_jft_scores.exam_keys(exam_id),
 question_number integer not null check (question_number between 27 and 38),
 mp3 text not null check (length(mp3) between 1000 and 850000),
 sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key (exam_id,question_number)
);
alter table ikigai_jft_scores.audio_updates enable row level security;
revoke all on ikigai_jft_scores.audio_updates from public,anon,authenticated;
create or replace function ikigai_jft_scores.audio_get(p_exam_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not ikigai_jft_scores.can_read_packages() then raise insufficient_privilege using message='Cần đăng nhập IKIGAI.'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('number',question_number,'mp3',mp3,'sha256',sha256) order by question_number),'[]'::jsonb) from ikigai_jft_scores.audio_updates where exam_id=p_exam_id);
end;$$;
create or replace function ikigai_jft_scores.audio_put(p_exam_id text,p_question_number integer,p_mp3 text,p_sha256 text,p_expected_sha256 text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old_sha text; bytes bytea; source_q jsonb;
begin
 if not ikigai_jft_scores.can_import_packages() then raise insufficient_privilege using message='Chỉ giáo viên được cập nhật âm thanh.'; end if;
 if p_exam_id is null or p_exam_id !~ '^sore-vol(1-(0[1-9]|10)|2-(1[1-9]|20))$' or p_question_number is null or p_question_number not between 27 and 38 then raise invalid_parameter_value using message='Mã đề hoặc câu nghe không hợp lệ.'; end if;
 if not exists(select 1 from ikigai_jft_scores.exam_keys where exam_id=p_exam_id) then raise invalid_parameter_value using message='Chưa có đề gốc.'; end if;
 if p_mp3 is null or length(p_mp3) not between 1000 and 850000 or length(p_mp3)%4<>0 or p_mp3 !~ '^[A-Za-z0-9+/]+={0,2}$' or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' then raise invalid_parameter_value using message='Audio không hợp lệ.'; end if;
 bytes:=decode(p_mp3,'base64');
 if encode(sha256(bytes),'hex')<>p_sha256 or not (substring(bytes from 1 for 3)=decode('494433','hex') or (get_byte(bytes,0)=255 and (get_byte(bytes,1)&224)=224)) then raise invalid_parameter_value using message='Mã kiểm tra hoặc định dạng MP3 không đúng.'; end if;
 select payload_text::jsonb->'tests'->0->'questions'->(p_question_number-1) into source_q from ikigai_jft_scores.packages where exam_id=p_exam_id;
 if found and (source_q is null or source_q->>'section'<>'2') then raise invalid_parameter_value using message='Câu đích không thuộc phần nghe.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('ikigai-jft-audio:'||p_exam_id||':'||p_question_number::text,0));
 select sha256 into old_sha from ikigai_jft_scores.audio_updates where exam_id=p_exam_id and question_number=p_question_number;
 if old_sha=p_sha256 then return jsonb_build_object('number',p_question_number,'sha256',p_sha256,'unchanged',true); end if;
 if old_sha is distinct from p_expected_sha256 then raise serialization_failure using message='Audio đã được người khác cập nhật; hãy kiểm tra và nạp lại.'; end if;
 insert into ikigai_jft_scores.audio_updates(exam_id,question_number,mp3,sha256,updated_by) values(p_exam_id,p_question_number,p_mp3,p_sha256,auth.uid())
 on conflict(exam_id,question_number) do update set mp3=excluded.mp3,sha256=excluded.sha256,updated_by=excluded.updated_by,updated_at=now();
 return jsonb_build_object('number',p_question_number,'sha256',p_sha256,'unchanged',false);
end;$$;
create or replace function public.ikigai_jft_audio_get(p_exam_id text) returns jsonb language sql security invoker set search_path='' as $$select ikigai_jft_scores.audio_get(p_exam_id);$$;
create or replace function public.ikigai_jft_audio_put(p_exam_id text,p_question_number integer,p_mp3 text,p_sha256 text,p_expected_sha256 text) returns jsonb language sql security invoker set search_path='' as $$select ikigai_jft_scores.audio_put(p_exam_id,p_question_number,p_mp3,p_sha256,p_expected_sha256);$$;
revoke all on function ikigai_jft_scores.audio_get(text),ikigai_jft_scores.audio_put(text,integer,text,text,text),public.ikigai_jft_audio_get(text),public.ikigai_jft_audio_put(text,integer,text,text,text) from public,anon;
grant execute on function ikigai_jft_scores.audio_get(text),ikigai_jft_scores.audio_put(text,integer,text,text,text),public.ikigai_jft_audio_get(text),public.ikigai_jft_audio_put(text,integer,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
