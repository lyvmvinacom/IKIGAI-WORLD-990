-- Teacher-managed deletion. Installing this file does not delete any account.
create table if not exists private.ikigai_account_deletions (
 id bigint generated always as identity primary key,
 actor_id uuid not null,
 target_id uuid not null,
 deleted_at timestamptz not null default clock_timestamp()
);
alter table private.ikigai_account_deletions enable row level security;
revoke all on private.ikigai_account_deletions from public,anon,authenticated;

create or replace function private.ikigai_last_activity(p_user_id uuid) returns timestamptz
language sql stable security definer set search_path='' as $$
 select greatest(u.last_sign_in_at,c.seen_at,
  (select max(d.last_seen) from public.ikigai_learning_diary d where d.user_id=u.id))
 from auth.users u left join private.ikigai_diary_clock c on c.user_id=u.id where u.id=p_user_id
$$;
revoke all on function private.ikigai_last_activity(uuid) from public,anon,authenticated;

create or replace function private.ikigai_registration_list() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.ikigai_is_teacher() then raise exception 'Chỉ giáo viên được xem yêu cầu đăng ký.' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
 'user_id',r.user_id,'email',u.email,
 'nickname',left(coalesce(nullif(trim(p.nickname),''),nullif(trim(u.raw_user_meta_data->>'nickname'),''),split_part(u.email,'@',1),'Học viên'),80),
 'status',r.status,'requested_at',r.requested_at,'reviewed_at',r.reviewed_at,
 'last_sign_in_at',u.last_sign_in_at,'last_game_at',c.seen_at,
 'last_activity_at',private.ikigai_last_activity(u.id),
 'is_online',coalesce(c.active and c.seen_at>statement_timestamp()-interval '90 seconds',false)) order by r.requested_at desc)
 from private.ikigai_registrations r join auth.users u on u.id=r.user_id
 left join public.ikigai_world_profiles p on p.user_id=u.id
 left join private.ikigai_diary_clock c on c.user_id=u.id
 where u.deleted_at is null and not coalesce(u.is_anonymous,false)
 and coalesce(u.raw_app_meta_data->>'role','')<>'teacher' and coalesce(p.role,'')<>'teacher'),'[]'::jsonb);
end $$;

create or replace function private.ikigai_registration_delete(
 p_user_id uuid,p_confirm_email text,p_expected_last_activity timestamptz
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u auth.users%rowtype; activity timestamptz;
begin
 if not private.ikigai_is_teacher() then raise exception 'Chỉ giáo viên được xoá tài khoản.' using errcode='42501'; end if;
 if p_user_id is null or p_user_id=auth.uid() then raise exception 'Không được xoá tài khoản đang đăng nhập.' using errcode='42501'; end if;
 -- Serialize with the game's heartbeat, including other tabs/devices.
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,9127));
 select * into u from auth.users where id=p_user_id for update;
 if not found or u.deleted_at is not null then raise exception 'Tài khoản không còn tồn tại. Hãy tải lại danh sách.'; end if;
 if u.raw_app_meta_data->>'role'='teacher' or exists(select 1 from public.ikigai_world_profiles where user_id=u.id and role='teacher') then
  raise exception 'Không được xoá tài khoản giáo viên.' using errcode='42501';
 end if;
 if coalesce(u.is_anonymous,false) or not exists(select 1 from private.ikigai_registrations where user_id=u.id) then
  raise exception 'Tài khoản không thuộc danh sách quản lý.';
 end if;
 if p_confirm_email is null or lower(trim(p_confirm_email)) is distinct from lower(u.email) then
  raise exception 'Email xác nhận không khớp. Chưa xoá tài khoản.';
 end if;
 activity:=private.ikigai_last_activity(u.id);
 if activity is distinct from p_expected_last_activity then
  raise exception 'Tài khoản vừa có hoạt động mới. Hãy tải lại và kiểm tra trước khi xoá.';
 end if;
 if exists(select 1 from private.ikigai_diary_clock where user_id=u.id and active and seen_at>clock_timestamp()-interval '90 seconds') then
  raise exception 'Tài khoản đang hoạt động. Hãy đợi học viên thoát game rồi tải lại.';
 end if;
 -- Preserve shared teaching content and files: never cascade these by accident.
 if exists(select 1 from public.game_rooms where created_by=u.id)
 or exists(select 1 from public.ikigai_assignments where created_by=u.id)
 or exists(select 1 from ikigai_tasks_private.assignments where created_by=u.id)
 or exists(select 1 from public.ikigai_grammar_question_edits where updated_by=u.id)
 or exists(select 1 from ikigai_jft_scores.packages where created_by=u.id)
 or exists(select 1 from ikigai_jft_scores.audio_updates where updated_by=u.id)
 or exists(select 1 from ikigai_jft_scores.exam_details where updated_by=u.id)
 or exists(select 1 from ikigai_jft_scores.furigana_overlays where updated_by=u.id)
 or exists(select 1 from ikigai_jft_scores.text_overlays where updated_by=u.id)
 or exists(select 1 from ikigai_jft_scores.exam_access where updated_by=u.id)
 or exists(select 1 from storage.objects where owner_id=u.id::text) then
  raise exception 'Tài khoản đang sở hữu nội dung dùng chung. Cần bàn giao nội dung trước khi xoá.';
 end if;

 delete from auth.refresh_tokens where user_id=u.id::text;
 delete from auth.sessions where user_id=u.id;
 delete from ikigai_ranked.answers where player=u.id;
 delete from ikigai_ranked.players where player=u.id;
 delete from ikigai_ranked.queue where player=u.id;
 delete from ikigai_ranked.ratings where player=u.id;
 delete from ikigai_kotoba_private.events where uid=u.id;
 delete from ikigai_kotoba_private.rewards where uid=u.id;
 delete from ikigai_kotoba_private.runs where uid=u.id;
 delete from ikigai_tasks_private.assignments where student_id=u.id;
 update public.ikigai_assignments set assigned_to=array_remove(assigned_to,u.id) where u.id=any(assigned_to);
 delete from public.ikigai_attempts where user_id=u.id;
 delete from public.ikigai_jft_drill_results where user_id=u.id;
 delete from ikigai_n4_private.attempts where user_id=u.id;
 delete from ikigai_n5_private.attempts where user_id=u.id;
 delete from ikigai_rewards_private.ledger where user_id=u.id;
 delete from ikigai_rewards_private.runs where user_id=u.id;
 delete from ikigai_rewards_private.backfill_jft_173 where user_id=u.id;
 delete from ikigai_rewards_private.policy_attempts where user_id=u.id;
 -- Cosmetics reference inventory; remove them before its parent profile cascades.
 delete from public.ikigai_world_cosmetics where user_id=u.id;
 delete from auth.users where id=u.id;
 insert into private.ikigai_account_deletions(actor_id,target_id) values(auth.uid(),u.id);
 return jsonb_build_object('user_id',u.id,'deleted',true);
end $$;
create or replace function public.ikigai_registration_delete(
 p_user_id uuid,p_confirm_email text,p_expected_last_activity timestamptz
) returns jsonb
language sql security invoker set search_path='' as $$
 select private.ikigai_registration_delete(p_user_id,p_confirm_email,p_expected_last_activity)
$$;
revoke all on function private.ikigai_registration_delete(uuid,text,timestamptz),public.ikigai_registration_delete(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function private.ikigai_registration_delete(uuid,text,timestamptz),public.ikigai_registration_delete(uuid,text,timestamptz) to authenticated;
notify pgrst,'reload schema';
