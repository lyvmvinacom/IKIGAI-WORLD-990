create or replace function public.ikigai_tasks_catalog() returns table(room text, category text, source text, lesson_key text, title text, sort_order integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if not ikigai_tasks_private.teacher() then raise insufficient_privilege using message='Teacher required';end if;
 return query
 select 'class'::text,'Từ vựng Minna'::text,'kotoba'::text,'minna:'||w.lesson||':vocab','Bài '||w.lesson,w.lesson from (select distinct lesson from ikigai_kotoba_private.words) w
 union all select 'class','Ngữ pháp · Bunpou Tetris','bunpou','minna:'||q.lesson||':grammar','Bài '||q.lesson,q.lesson from (select lesson from ikigai_ranked.bunpou_questions group by lesson having count(*)>=20) q
 union all select 'class','Chia thể động từ · '||v.lvl,'verb','verb:'||v.lvl||':'||v.form,case v.form when 'dictionary' then 'Thể từ điển' when 'te' then 'Thể て' when 'nai' then 'Thể ない' when 'ta' then 'Thể た' when 'potential' then 'Thể khả năng' when 'volitional' then 'Thể ý chí' when 'conditional' then 'Thể điều kiện' when 'imperative' then 'Thể mệnh lệnh' when 'prohibition' then 'Thể cấm' when 'passive' then 'Thể bị động' when 'causative' then 'Thể sai khiến' when 'causativePassive' then 'Thể sai khiến bị động' else v.form end,0 from (select distinct split_part(id,':',2) form,case when split_part(id,':',1)::int>=1000 then 'N4' else 'N5' end lvl from ikigai_rewards_private.verb_keys) v
 union all select 'jft',case when d.id like 'kanji-%' then 'Kanji' when d.id like 'vocabulary-%' then 'Từ vựng' else 'Hyōgen (bài luyện cũ)' end,'jft_drill','jft:'||d.id,d.title,d.position::integer from public.ikigai_jft_drill_sets d
 union all select 'jft',case when e.exam_id like 'sore-%' then 'Thi thử Sore' else 'Thi thử IKIGAI' end,'jft_exam','exam:'||e.exam_id,'Đề số '||regexp_replace(e.exam_id,'^.*-',''),0 from ikigai_jft_scores.exam_keys e
 union all select 'n4','Thi thử N4','n4_exam','n4:'||n.id,coalesce(n.payload->>'title',n.id),0 from ikigai_n4_private.exams n
 union all select 'class',case when g.i<=12 then 'Kiểm tra ngữ pháp N5' else 'Kiểm tra ngữ pháp N4' end,'grammar_exam','grammar:grammar-'||lpad(g.i::text,2,'0'),'Bài '||(case when g.i<=12 then g.i*2-1 else (g.i-12)*2+24 end)||'–'||(case when g.i<=12 then g.i*2 else (g.i-12)*2+25 end),g.i from generate_series(1,24) g(i)
 order by 1,2,6,5;
end$$;
revoke all on function public.ikigai_tasks_catalog() from public,anon,authenticated;
grant execute on function public.ikigai_tasks_catalog() to authenticated;
notify pgrst,'reload schema';