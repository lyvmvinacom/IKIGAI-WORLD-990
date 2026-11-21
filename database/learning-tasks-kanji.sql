ALTER TABLE ikigai_tasks_private.assignments DROP CONSTRAINT assignments_source_check;
ALTER TABLE ikigai_tasks_private.assignments ADD CONSTRAINT assignments_source_check CHECK(source IN ('kotoba','bunpou','verb','jft_drill','jft_exam','n4_exam','grammar_exam','kanji_bomb'));
CREATE OR REPLACE FUNCTION public.ikigai_tasks_save(
 p_id uuid,p_room text,p_source text,p_lesson_key text,p_title text,p_due_at timestamptz,p_student_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE output_id uuid;
BEGIN
 IF NOT ikigai_tasks_private.teacher() THEN RAISE insufficient_privilege USING message='Teacher required';END IF;
 IF p_room NOT IN ('class','n5','n4','jft')
 OR p_source NOT IN ('kotoba','bunpou','verb','jft_drill','jft_exam','n4_exam','grammar_exam','kanji_bomb')
 OR length(trim(coalesce(p_title,''))) NOT BETWEEN 3 AND 120
 OR length(trim(coalesce(p_lesson_key,''))) NOT BETWEEN 3 AND 180
 THEN RAISE EXCEPTION 'Invalid task';END IF;
 -- Explicit combinations keep teacher from accidentally targeting unrelated rooms.
 IF (p_room='jft' AND p_source NOT IN ('jft_drill','jft_exam'))
 OR (p_room='n4' AND p_source NOT IN ('n4_exam','grammar_exam','verb'))
 OR (p_room='n5' AND p_source NOT IN ('grammar_exam','verb','bunpou','kotoba'))
 OR (p_room='class' AND p_source NOT IN ('kotoba','bunpou','verb','grammar_exam','kanji_bomb'))
 THEN RAISE EXCEPTION 'Source does not belong to room';END IF;
 IF (p_source='kanji_bomb' AND p_lesson_key !~ '^kanji-bomb:([1-9]|[12][0-9]|3[012])$')
 OR (p_source='kotoba' AND p_lesson_key !~ '^minna:[0-9]+:vocab$')
 OR (p_source='bunpou' AND p_lesson_key !~ '^minna:[0-9]+:grammar$')
 OR (p_source='verb' AND p_lesson_key !~ '^verb:(N5|N4):[a-zA-Z]+$')
 OR (p_source='jft_drill' AND p_lesson_key !~ '^jft:[a-zA-Z0-9_.:-]+$')
 OR (p_source='jft_exam' AND p_lesson_key !~ '^exam:[a-zA-Z0-9_.:-]+$')
 OR (p_source='n4_exam' AND p_lesson_key !~ '^n4:[a-zA-Z0-9_.:-]+$')
 OR (p_source='grammar_exam' AND p_lesson_key !~ '^grammar:[a-zA-Z0-9_.:-]+$')
 THEN RAISE EXCEPTION 'Invalid lesson key for source'; END IF;
 IF p_student_id IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM public.ikigai_world_profiles p
 JOIN auth.users u ON u.id=p.user_id
 WHERE p.user_id=p_student_id AND p.role='student' AND NOT coalesce(u.is_anonymous,false))
 THEN RAISE EXCEPTION 'Unknown student account';END IF;
 IF p_id IS NULL THEN
  INSERT INTO ikigai_tasks_private.assignments(room,source,lesson_key,title,student_id,due_at,created_by)
  VALUES(p_room,p_source,p_lesson_key,trim(p_title),p_student_id,p_due_at,auth.uid()) RETURNING id INTO output_id;
 ELSE
  UPDATE ikigai_tasks_private.assignments SET room=p_room,source=p_source,
  lesson_key=p_lesson_key,title=trim(p_title),student_id=p_student_id,due_at=p_due_at
  WHERE id=p_id RETURNING id INTO output_id;
  IF output_id IS NULL THEN RAISE EXCEPTION 'Task not found';END IF;
 END IF;
 RETURN output_id;
END$$;


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
 union all select 'class','Kanji · Gỡ bom','kanji_bomb','kanji-bomb:'||g.i,'Bài '||g.i,g.i from generate_series(1,32) g(i)
 order by 1,2,6,5;
end$$;
revoke all on function public.ikigai_tasks_catalog() from public,anon,authenticated;
grant execute on function public.ikigai_tasks_catalog() to authenticated;
notify pgrst,'reload schema';
CREATE OR REPLACE FUNCTION public.ikigai_kanji_bomb_finish(p_lesson integer,p_attempt uuid,p_correct integer,p_total integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=ikigai_rewards_private.member();r jsonb;
BEGIN
 IF p_lesson IS NULL OR p_lesson NOT BETWEEN 1 AND 32 OR p_total IS DISTINCT FROM (CASE WHEN p_lesson=32 THEN 13 ELSE 10 END) OR p_correct IS NULL OR p_correct NOT BETWEEN 0 AND p_total OR p_attempt IS NULL THEN RAISE EXCEPTION 'Invalid Kanji result';END IF;
 r:=ikigai_rewards_private.settle_v2(u,'kanji_bomb','kanji-bomb:'||p_lesson,p_attempt,p_correct,p_total,least(p_correct*10,200),50);
 RETURN r||jsonb_build_object('xp',r->'xp_total','coins',r->'coins_total');
END$$;
REVOKE ALL ON FUNCTION public.ikigai_kanji_bomb_finish(integer,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ikigai_kanji_bomb_finish(integer,uuid,integer,integer) TO authenticated;
notify pgrst,'reload schema';