CREATE OR REPLACE FUNCTION public.ikigai_ranked_play(p_action text, p_match uuid DEFAULT NULL::uuid, p_round integer DEFAULT NULL::integer, p_option integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  who uuid := auth.uid();
  t timestamptz;
  s date;
  m ikigai_ranked.matches;
  me ikigai_ranked.players;
  rival ikigai_ranked.players;
  other uuid;
  deck jsonb;
  q jsonb;
  r integer;
  seen boolean;
  rating integer;
  player_xp integer;
begin
  if who is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
    or coalesce(auth.jwt()->'app_metadata'->>'role','') = 'teacher'
    or not exists (select 1 from public.ikigai_world_profiles where user_id = who and role = 'student')
  then raise exception 'Student account required'; end if;

  if p_action is null or p_action not in ('join','poll','leave','answer','ack') then raise exception 'Invalid ranked action'; end if;
  perform pg_advisory_xact_lock(193721, 1);
  t := clock_timestamp();
  s := ikigai_ranked.month_at(t);
  perform ikigai_ranked.settle(t);

  if p_action = 'leave' then
    delete from ikigai_ranked.queue where player = who;
    return jsonb_build_object('state','idle');
  end if;
  if p_action = 'ack' then
    update ikigai_ranked.players p set acknowledged = true from ikigai_ranked.matches a
    where p.match_id = a.id and p.player = who and a.id = p_match and a.settled_at is not null;
    return jsonb_build_object('state','idle');
  end if;

  select a.* into m from ikigai_ranked.matches a join ikigai_ranked.players p on p.match_id = a.id
    where p.player = who and not p.acknowledged order by a.starts_at desc limit 1;
  if p_action = 'answer' and (m.id is distinct from p_match or m.id is null) then
    raise exception 'Ranked match unavailable';
  end if;

  if m.id is null and p_action = 'join' then
    if t + interval '5 minutes 6 seconds' >= ikigai_ranked.end_of(s) then
      delete from ikigai_ranked.queue where player = who;
      return jsonb_build_object('state','closing');
    end if;
    insert into ikigai_ranked.queue as queue (player, season, joined_at, seen_at) values(who,s,t,t)
    on conflict(player) do update set season = s, seen_at = t,
      joined_at = case when queue.season = s and queue.seen_at >= t - interval '20 seconds' then queue.joined_at else t end;
  end if;

  if m.id is null then
    if not exists (select 1 from ikigai_ranked.queue where player = who and season = s and seen_at >= t - interval '20 seconds') then
      return jsonb_build_object('state','idle');
    end if;
    if t + interval '5 minutes 6 seconds' >= ikigai_ranked.end_of(s) then
      delete from ikigai_ranked.queue where player = who;
      return jsonb_build_object('state','closing');
    end if;
    delete from ikigai_ranked.queue where seen_at < t - interval '20 seconds' or season <> s;
    update ikigai_ranked.queue set seen_at = t where player = who;
    rating := coalesce((select r0.rating from ikigai_ranked.ratings r0 where r0.season = s and r0.player = who), ikigai_ranked.initial_rating(s,who));
    select candidate.player into other from ikigai_ranked.queue candidate
    where candidate.player <> who and (
      select count(*) from ikigai_ranked.players a
      join ikigai_ranked.players b on a.match_id = b.match_id and b.player = candidate.player
      join ikigai_ranked.matches history on history.id = a.match_id
      where a.player = who and not history.void
        and history.starts_at >= (date_trunc('day', t at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh')
    ) < 3
    order by abs(coalesce((select r0.rating from ikigai_ranked.ratings r0 where r0.season = s and r0.player = candidate.player),
      ikigai_ranked.initial_rating(s,candidate.player)) - rating), candidate.joined_at, candidate.player limit 1;
    if other is null then return jsonb_build_object('state','queue'); end if;

    -- Shuffle both the questions and the option order once per match.
    select jsonb_agg(jsonb_build_object('prompt', chosen.prompt,'options', shuffled.options,'correct',shuffled.correct,'image',chosen.image,'image_alt',chosen.image_alt)
      order by random()) into deck
    from (
      (select * from ikigai_ranked.classroom_questions where category = 'vocabulary' order by random() limit 7)
      union all (select * from ikigai_ranked.classroom_questions where category = 'grammar' order by random() limit 7)
      union all (select * from ikigai_ranked.classroom_questions where category = 'kanji' order by random() limit 6)
    ) chosen
    cross join lateral (
      select jsonb_agg(v.option order by v.pos) as options, max(v.pos - 1) filter (where v.idx = chosen.correct + 1) as correct
      from (
        select option, idx, row_number() over (order by random()) as pos
        from jsonb_array_elements(chosen.options) with ordinality as opts(option,idx)
      ) v
    ) shuffled;
    if coalesce(jsonb_array_length(deck),0) <> 20 then raise exception 'Ranked question bank is incomplete'; end if;

    insert into ikigai_ranked.ratings(season,player,rating)
    select s,id,ikigai_ranked.initial_rating(s,id) from unnest(array[who,other]) as roster(id)
    on conflict do nothing;
    insert into ikigai_ranked.matches(season,starts_at,ends_at,questions)
    values(s,t + interval '5 seconds',t + interval '305 seconds',deck) returning * into m;
    insert into ikigai_ranked.players(match_id,player,seat) values(m.id,who,1),(m.id,other,2);
    delete from ikigai_ranked.queue where player in (who,other);
  end if;

  select * into me from ikigai_ranked.players where match_id = m.id and player = who;
  select * into rival from ikigai_ranked.players where match_id = m.id and player <> who;
  if m.settled_at is not null then
    select xp into player_xp from public.ikigai_world_profiles where user_id = who;
    return jsonb_build_object('state','result','id',m.id,'void',m.void,'correct',me.correct,'opponent_correct',rival.correct,
      'outcome',me.outcome,'rating',me.rating_after,'delta',me.rating_delta,'earned',me.xp_awarded,'xp',player_xp,'season',m.season,
      'player_name',coalesce((select nickname from public.ikigai_world_profiles where user_id=who),'Học viên'),
      'opponent',coalesce((select nickname from public.ikigai_world_profiles where user_id=rival.player),'Học viên'));
  end if;

  r := floor(extract(epoch from t - m.starts_at)/15);
  q := case when r between 0 and 19 then m.questions->r end;
  if p_action = 'answer' and r = p_round and p_option between 0 and 3 and q is not null then
    insert into ikigai_ranked.answers(match_id,player,round,correct)
    values(m.id,who,r,p_option = (q->>'correct')::integer) on conflict do nothing;
  end if;
  select exists (select 1 from ikigai_ranked.answers where match_id = m.id and player = who and round = r) into seen;
  return jsonb_build_object('state','match','id',m.id,'round',r,'question',q - 'correct','answered',seen,
    'server_time',t,'next_at',m.starts_at + greatest(0,r+1)*interval '15 seconds',
    'opponent',coalesce((select nickname from public.ikigai_world_profiles where user_id = rival.player),'Học viên'));
end
$function$;
