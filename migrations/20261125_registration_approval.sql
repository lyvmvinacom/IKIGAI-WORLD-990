-- New registrations are pending. Existing real members are grandfathered in.
create schema if not exists private;
create table private.ikigai_registrations (
 user_id uuid primary key references auth.users(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 requested_at timestamptz not null default clock_timestamp(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete set null
);
create index ikigai_registrations_pending on private.ikigai_registrations(status,requested_at desc);
alter table private.ikigai_registrations enable row level security;
revoke all on private.ikigai_registrations from public,anon,authenticated;
insert into private.ikigai_registrations(user_id,status,requested_at,reviewed_at)
 select id,'approved',created_at,clock_timestamp() from auth.users
 where deleted_at is null and not coalesce(is_anonymous,false);

create function private.ikigai_is_teacher() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=auth.uid() and deleted_at is null
 and not coalesce(is_anonymous,false) and raw_app_meta_data->>'role'='teacher')
$$;
create function private.ikigai_member_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u left join private.ikigai_registrations r on r.user_id=u.id
 where u.id=auth.uid() and u.deleted_at is null and not coalesce(u.is_anonymous,false)
 and (u.raw_app_meta_data->>'role'='teacher' or r.status='approved'))
$$;
revoke all on function private.ikigai_is_teacher() from public,anon,authenticated;
revoke all on function private.ikigai_member_allowed() from public,anon,authenticated;
grant usage on schema private to anon,authenticated,service_role;
grant execute on function private.ikigai_member_allowed() to anon,authenticated,service_role;

create function private.ikigai_registration_created() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_when='BEFORE' then
  if coalesce(new.is_anonymous,false) then raise exception 'IKIGAI không còn hỗ trợ chế độ khách.' using errcode='42501'; end if;
  return new;
 end if;
 if not coalesce(new.is_anonymous,false) and new.deleted_at is null then
  insert into private.ikigai_registrations(user_id) values(new.id) on conflict(user_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function private.ikigai_registration_created() from public,anon,authenticated;
create trigger ikigai_block_new_guest before insert on auth.users for each row execute function private.ikigai_registration_created();
create trigger ikigai_request_registration after insert or update of is_anonymous on auth.users for each row execute function private.ikigai_registration_created();

create function private.ikigai_account_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u auth.users%rowtype; s text;
begin
 select * into u from auth.users where id=auth.uid() and deleted_at is null;
 if not found then raise exception 'Cần đăng nhập tài khoản IKIGAI.' using errcode='42501'; end if;
 if coalesce(u.is_anonymous,false) then return jsonb_build_object('status','guest_disabled','allowed',false); end if;
 if u.raw_app_meta_data->>'role'='teacher' then return jsonb_build_object('status','approved','allowed',true,'teacher',true); end if;
 select status into s from private.ikigai_registrations where user_id=u.id;
 return jsonb_build_object('status',coalesce(s,'pending'),'allowed',coalesce(s='approved',false),'teacher',false);
end $$;
create function public.ikigai_account_status() returns jsonb
language sql stable security invoker set search_path='' as $$ select private.ikigai_account_status() $$;
revoke all on function private.ikigai_account_status() from public,anon,authenticated;
revoke all on function public.ikigai_account_status() from public,anon,authenticated;
grant execute on function private.ikigai_account_status(),public.ikigai_account_status() to authenticated,service_role;

create function private.ikigai_registration_list() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.ikigai_is_teacher() then raise exception 'Chỉ giáo viên được xem yêu cầu đăng ký.' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',r.user_id,'email',u.email,
 'nickname',left(coalesce(nullif(trim(u.raw_user_meta_data->>'nickname'),''),split_part(u.email,'@',1),'Học viên'),80),
 'status',r.status,'requested_at',r.requested_at,'reviewed_at',r.reviewed_at) order by r.requested_at desc)
 from private.ikigai_registrations r join auth.users u on u.id=r.user_id
 where u.deleted_at is null and not coalesce(u.is_anonymous,false) and coalesce(u.raw_app_meta_data->>'role','')<>'teacher'),'[]'::jsonb);
end $$;
create function public.ikigai_registration_list() returns jsonb
language sql stable security invoker set search_path='' as $$ select private.ikigai_registration_list() $$;
create function private.ikigai_registration_review(p_user_id uuid,p_decision text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.ikigai_registrations%rowtype;
begin
 if not private.ikigai_is_teacher() then raise exception 'Chỉ giáo viên được duyệt đăng ký.' using errcode='42501'; end if;
 if p_decision not in ('approved','rejected') or p_decision is null then raise exception 'Quyết định không hợp lệ.'; end if;
 -- Only registrations not yet admitted are reviewable; existing members cannot be accidentally revoked here.
 update private.ikigai_registrations set status=p_decision,reviewed_at=clock_timestamp(),reviewed_by=auth.uid()
 where user_id=p_user_id and status in ('pending','rejected')
 and exists(select 1 from auth.users u where u.id=p_user_id and u.deleted_at is null and not coalesce(u.is_anonymous,false)
 and coalesce(u.raw_app_meta_data->>'role','')<>'teacher') returning * into r;
 if not found then raise exception 'Yêu cầu đã được xử lý hoặc không còn tồn tại. Hãy tải lại danh sách.'; end if;
 return jsonb_build_object('user_id',r.user_id,'status',r.status,'reviewed_at',r.reviewed_at);
end $$;
create function public.ikigai_registration_review(p_user_id uuid,p_decision text) returns jsonb
language sql security invoker set search_path='' as $$ select private.ikigai_registration_review(p_user_id,p_decision) $$;
revoke all on function private.ikigai_registration_list(),public.ikigai_registration_list() from public,anon,authenticated;
revoke all on function private.ikigai_registration_review(uuid,text),public.ikigai_registration_review(uuid,text) from public,anon,authenticated;
grant execute on function private.ikigai_registration_list(),public.ikigai_registration_list(),private.ikigai_registration_review(uuid,text),public.ikigai_registration_review(uuid,text) to authenticated;

-- Apply to RPCs as well as REST tables, including SECURITY DEFINER RPCs.
create function private.ikigai_check_request() returns void
language plpgsql stable security invoker set search_path='' as $$
declare path text:=trim(both '/' from coalesce(current_setting('request.path',true),''));
begin
 if current_setting('role',true)='service_role' then return; end if;
 if path='rpc/ikigai_account_status' then return; end if;
 if not private.ikigai_member_allowed() then
  raise exception 'Tài khoản chưa được giáo viên phê duyệt. Vui lòng đăng nhập bằng tài khoản đã được duyệt.' using errcode='42501';
 end if;
end $$;
revoke all on function private.ikigai_check_request() from public,anon,authenticated;
grant execute on function private.ikigai_check_request() to anon,authenticated,service_role;
alter role authenticator set pgrst.db_pre_request='private.ikigai_check_request';

-- Restrictive policies also protect direct table, Storage, and Postgres-change subscriptions.
do $$ declare item record; begin
 for item in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity loop
  execute format('create policy ikigai_approved_members_only on public.%I as restrictive for all to anon,authenticated using ((select private.ikigai_member_allowed())) with check ((select private.ikigai_member_allowed()))',item.relname);
 end loop;
end $$;
create policy ikigai_approved_members_only on storage.objects as restrictive for all to anon,authenticated
 using ((select private.ikigai_member_allowed())) with check ((select private.ikigai_member_allowed()));
-- The new world channel is private; the old public topic will no longer carry current players.
create policy ikigai_members_receive on realtime.messages for select to authenticated
 using (realtime.topic()='ikigai-world-members-v2' and (select private.ikigai_member_allowed()));
create policy ikigai_members_send on realtime.messages for insert to authenticated
 with check (realtime.topic()='ikigai-world-members-v2' and (select private.ikigai_member_allowed()));
notify pgrst,'reload config';
notify pgrst,'reload schema';
