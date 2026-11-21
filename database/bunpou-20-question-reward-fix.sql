CREATE OR REPLACE FUNCTION public.ikigai_start_lesson_reward(p_source text, p_attempt uuid, p_ids text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=ikigai_rewards_private.member();n integer;lesson_id integer;existing text[];begin
 if p_attempt is null or p_ids is null or cardinality(p_ids) not between 1 and 500
 or array_position(p_ids,null) is not null or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids)x) then raise exception 'Invalid lesson';end if;
 case p_source
 when 'verb' then
  if cardinality(p_ids)<>10 then raise exception 'Need 10 verbs';end if;
  select count(*) into n from ikigai_rewards_private.verb_keys where id=any(p_ids);
  if (select count(distinct split_part(x,':',2)) from unnest(p_ids)x)<>1 then raise exception 'Mixed conjugation forms';end if;
 when 'bunpou' then
  select min(lesson),count(*) into lesson_id,n from ikigai_ranked.bunpou_questions where id=any(p_ids);
  if cardinality(p_ids)=20 then
   if (select count(*) from ikigai_ranked.bunpou_questions where lesson=lesson_id)<>20
    or exists(select 1 from ikigai_ranked.bunpou_questions where id=any(p_ids) and lesson<>lesson_id) then raise exception 'Need full 20-question lesson';end if;
  elsif cardinality(p_ids)=30 then
   if (select count(distinct lesson) from ikigai_ranked.bunpou_questions where id=any(p_ids))<2 then raise exception 'Invalid mixed review';end if;
  else raise exception 'Need 20-question lesson or 30-question mixed review';end if;
 when 'kotoba' then
  select min(w.lesson),count(*) into lesson_id,n from ikigai_kotoba_private.words w where w.id=any(p_ids);
  if exists(select 1 from ikigai_kotoba_private.words w where w.id=any(p_ids) and w.lesson<>lesson_id)
   or (select count(*) from ikigai_kotoba_private.words w where w.lesson=lesson_id)<>cardinality(p_ids) then raise exception 'Need full vocabulary lesson';end if;
 else raise exception 'Unknown lesson';end case;
 if n<>cardinality(p_ids) then raise exception 'Unknown questions';end if;
 insert into ikigai_rewards_private.runs(user_id,source,attempt,ids) values(u,p_source,p_attempt,p_ids) on conflict do nothing;
 select r.ids into existing from ikigai_rewards_private.runs r where r.user_id=u and r.source=p_source and r.attempt=p_attempt;
 if existing is distinct from p_ids then raise exception 'Attempt reused with different questions';end if;
 return jsonb_build_object('registered',true);
end$function$;
CREATE OR REPLACE FUNCTION ikigai_rewards_private.game_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE u uuid;src text;run_id uuid;ids text[];done integer;correct_count integer;
 lesson integer; key text; coins_base integer:=50; xp_base integer; receipt jsonb;run_created timestamptz;
BEGIN
 IF tg_table_schema='ikigai_kotoba_private' THEN
   u:=new.uid;src:='kotoba';run_id:=new.run;
 ELSE u:=new.player;src:='bunpou';run_id:=new.run;END IF;
 SELECT r.ids,r.created_at INTO ids,run_created FROM ikigai_rewards_private.runs r
 WHERE r.user_id=u AND r.source=src AND r.attempt=run_id;
 IF ids IS NULL OR run_created<(SELECT live_at FROM ikigai_rewards_private.v2_activation WHERE id) THEN RETURN new;END IF;
 IF src='kotoba' THEN
  SELECT count(distinct e.word),count(distinct e.word) FILTER (WHERE e.correct)
  INTO done,correct_count
  FROM ikigai_kotoba_private.events e WHERE e.uid=u AND e.run=run_id AND e.word=ANY(ids);
  SELECT min(w.lesson) INTO lesson FROM ikigai_kotoba_private.words w WHERE w.id=ANY(ids);
  key:='minna:'||lesson||':vocab';
  xp_base:=least(200,correct_count*2+CASE WHEN correct_count=cardinality(ids) THEN 50 ELSE 0 END);
 ELSE
  SELECT count(*),count(*) FILTER (WHERE b.correct) INTO done,correct_count
  FROM ikigai_ranked.bunpou_attempts b WHERE b.player=u AND b.run=run_id AND b.question=ANY(ids);
  SELECT min(q.lesson) INTO lesson FROM ikigai_ranked.bunpou_questions q WHERE q.id=ANY(ids);
  key:=CASE WHEN cardinality(ids)=30 THEN 'minna:all:grammar' ELSE 'minna:'||lesson||':grammar' END;
  xp_base:=least(200,correct_count*10);
 END IF;
 IF done=cardinality(ids) THEN
  receipt:=ikigai_rewards_private.settle_v2(u,src,key,run_id,correct_count,done,xp_base,coins_base);
 END IF;
 RETURN new;
END$function$;
notify pgrst,'reload schema';