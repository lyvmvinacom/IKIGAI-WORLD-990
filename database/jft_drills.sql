create table if not exists public.ikigai_jft_drill_sets(id text primary key,position integer not null,title text not null,payload jsonb not null);
alter table public.ikigai_jft_drill_sets enable row level security;
revoke all on public.ikigai_jft_drill_sets from anon,authenticated;
grant select on public.ikigai_jft_drill_sets to authenticated;
create policy jft_drills_members on public.ikigai_jft_drill_sets for select to authenticated using(auth.uid() is not null and coalesce(auth.jwt()->>'is_anonymous','false')<>'true');
create table if not exists public.ikigai_jft_drill_results(attempt_id uuid primary key,user_id uuid not null references auth.users(id),test_id text not null,correct_count integer not null,total_count integer not null,xp_awarded integer not null,answers integer[] not null,created_at timestamptz not null default now());
create index if not exists jft_drill_user_test on public.ikigai_jft_drill_results(user_id,test_id);
alter table public.ikigai_jft_drill_results enable row level security;
revoke all on public.ikigai_jft_drill_results from anon,authenticated;
grant select on public.ikigai_jft_drill_results to authenticated;
create policy jft_drill_own_results on public.ikigai_jft_drill_results for select to authenticated using(user_id=(select auth.uid()) and coalesce(auth.jwt()->>'is_anonymous','false')<>'true');
create or replace function public.ikigai_jft_drill_submit(p_attempt_id uuid,p_test_id text,p_ids text[],p_answers integer[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();qs jsonb;q jsonb;i integer:=0;correct integer:=0;total integer:=0;earned integer:=0;prior integer;current_xp integer;saved public.ikigai_jft_drill_results;is_teacher boolean;
begin
 select u.raw_app_meta_data->>'role'='teacher' into is_teacher from auth.users u where u.id=uid and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now());
 if not found then raise insufficient_privilege using message='Cần đăng nhập tài khoản IKIGAI.';end if;
 if p_attempt_id is null or cardinality(p_ids) not between 1 and 500 or cardinality(p_ids) is distinct from cardinality(p_answers) or array_lower(p_ids,1)<>1 or array_lower(p_answers,1)<>1 then raise exception 'Bài luyện không hợp lệ';end if;
 select payload->'questions' into qs from public.ikigai_jft_drill_sets where id=p_test_id;
 if qs is null then
  if p_test_id!~'^excel-(kanji|vocabulary|hyogen)-[0-9]+-[0-9]+$' then raise exception 'Không tìm thấy đề';end if;
  select jsonb_agg(jsonb_build_object('id',r.id,'options',r.options,'accepted',jsonb_build_array(strpos('ABCD',r.correct)-1)) order by r.id collate "C") into qs
  from (select r.* from public.ikigai_room_questions r where r.room='jft'
   and r."group"=case split_part(p_test_id,'-',2) when 'hyogen' then 'grammar' else split_part(p_test_id,'-',2) end
   and r.lesson=split_part(p_test_id,'-',3)::int order by r.id collate "C" limit 20 offset greatest(0,(split_part(p_test_id,'-',4)::int-1)*20)) r;
 end if;
 if qs is null or jsonb_array_length(qs)<>cardinality(p_ids) then raise exception 'Bộ câu hỏi đã thay đổi, hãy mở lại đề';end if;
 for q in select value from jsonb_array_elements(qs) loop
  i:=i+1;
  if q->>'id' is distinct from p_ids[i] or p_answers[i] is null or p_answers[i]<-1 or p_answers[i]>=jsonb_array_length(q->'options') then raise exception 'Câu trả lời không hợp lệ';end if;
  if jsonb_array_length(q->'accepted')>0 then total:=total+1;if q->'accepted' @> to_jsonb(p_answers[i]) then correct:=correct+1;end if;end if;
 end loop;
 select xp into current_xp from public.ikigai_world_profiles where user_id=uid for update;
 if not found then raise exception 'Chưa có hồ sơ';end if;
 select * into saved from public.ikigai_jft_drill_results where attempt_id=p_attempt_id;
 if found then
  if saved.user_id<>uid or saved.test_id<>p_test_id then raise exception 'Mã lượt làm không hợp lệ';end if;
  return jsonb_build_object('correct',saved.correct_count,'total',saved.total_count,'xp_awarded',saved.xp_awarded,'xp_total',current_xp);
 end if;
 select coalesce(sum(xp_awarded),0) into prior from public.ikigai_jft_drill_results where user_id=uid and test_id=p_test_id;
 earned:=case when coalesce(is_teacher,false) then 0 else greatest(0,least(correct*10,200)-prior) end;
 insert into public.ikigai_jft_drill_results values(p_attempt_id,uid,p_test_id,correct,total,earned,p_answers,now());
 if earned>0 then update public.ikigai_world_profiles set xp=xp+earned,updated_at=now() where user_id=uid returning xp into current_xp;end if;
 return jsonb_build_object('correct',correct,'total',total,'xp_awarded',earned,'xp_total',current_xp);
end;
$$;
revoke all on function public.ikigai_jft_drill_submit(uuid,text,text[],integer[]) from public,anon,authenticated;
grant execute on function public.ikigai_jft_drill_submit(uuid,text,text[],integer[]) to authenticated;
