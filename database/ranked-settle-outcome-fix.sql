CREATE OR REPLACE FUNCTION ikigai_ranked.settle(t timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  m ikigai_ranked.matches;
  p record;
  n integer[];
  attempts integer[];
  ratings integer[];
  score_fraction numeric;
  delta integer;
  reward integer;
  earned_today integer;
  day_start timestamptz;
begin
  for m in select * from ikigai_ranked.matches where settled_at is null and ends_at <= t order by ends_at, id loop
    select array_agg(counted.attempts order by counted.seat), array_agg(counted.correct order by counted.seat)
    into attempts, n
    from (
      select p2.seat, count(a.round)::integer as attempts, count(a.round) filter (where a.correct)::integer as correct
      from ikigai_ranked.players p2 left join ikigai_ranked.answers a
        on a.match_id = p2.match_id and a.player = p2.player
      where p2.match_id = m.id group by p2.seat
    ) counted;
    if attempts[1] + attempts[2] = 0 then
      update ikigai_ranked.matches set settled_at = t, void = true where id = m.id;
      continue;
    end if;

    select array_agg(r.rating order by p2.seat) into ratings
    from ikigai_ranked.players p2 join ikigai_ranked.ratings r
      on r.season = m.season and r.player = p2.player
    where p2.match_id = m.id;

    day_start := date_trunc('day', m.ends_at at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh';
    for p in select * from ikigai_ranked.players where match_id = m.id order by player loop
      score_fraction := case when attempts[p.seat] = 0 then 0 when attempts[3-p.seat] = 0 then 1
        when n[p.seat] > n[3-p.seat] then 1 when n[p.seat] = n[3-p.seat] then 0.5 else 0 end;
      delta := round(40 * (score_fraction - 1 / (1 + power(10::numeric, (ratings[3-p.seat] - ratings[p.seat]) / 400.0))));
      select coalesce(sum(old.xp_awarded), 0) into earned_today
      from ikigai_ranked.players old join ikigai_ranked.matches history on history.id = old.match_id
      where old.player = p.player and history.ends_at >= day_start
        and history.ends_at < day_start + interval '24 hours' and history.settled_at is not null;

      -- An absent player can lose rating, but receives no reward or placement credit.
      reward := 0;
      if attempts[p.seat] > 0 then
        reward := least(greatest(0, 200 - earned_today), 5 * n[p.seat] + (10 * score_fraction)::integer);
        update public.ikigai_world_profiles
        set xp = xp + reward, updated_at = t where user_id = p.player and reward > 0;
      end if;
      update ikigai_ranked.ratings
      set rating = rating + delta,
        games = games + case when attempts[p.seat] > 0 then 1 else 0 end,
        rated = true,
        wins = wins + case when score_fraction = 1 then 1 else 0 end
      where season = m.season and player = p.player;
      update ikigai_ranked.players
      set correct = n[p.seat], rating_after = ratings[p.seat] + delta, rating_delta = delta, xp_awarded = reward,
        outcome = case when score_fraction = 1 then 'win' when score_fraction = 0.5 then 'draw' else 'lose' end
      where match_id = m.id and player = p.player;
    end loop;
    update ikigai_ranked.matches set settled_at = t where id = m.id;
  end loop;
end
$function$;

