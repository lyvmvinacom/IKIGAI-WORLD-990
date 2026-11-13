-- Classroom source snapshots live with the existing private arena data.
create table if not exists ikigai_ranked.classroom_bank (
 id text primary key,
 payload jsonb not null check(jsonb_typeof(payload)='object')
);
alter table ikigai_ranked.classroom_bank enable row level security;
revoke all on ikigai_ranked.classroom_bank from public,anon,authenticated;

-- Runtime teacher edits take precedence; no editorial approval flag is required.
create or replace view ikigai_ranked.classroom_questions with (security_invoker=true) as
with merged as (
 select b.id,
   case when b.payload->>'source'='grammar-tests' and e.payload is not null
    then b.payload || jsonb_build_object('question',e.payload->'question','options',e.payload->'options','correct',e.payload->'correct',
      'image',coalesce(e.payload->'image',b.payload->'image'),'image_alt',coalesce(e.payload->'image_alt',b.payload->'image_alt'))
    else b.payload end as q
 from ikigai_ranked.classroom_bank b
 left join public.ikigai_grammar_question_edits e on b.payload->>'source'='grammar-tests'
   and e.test_id=b.payload->>'test_id' and e.question_id=b.payload->>'source_id'
 union all
 select 'CLASS-CUSTOM-'||r.id,jsonb_build_object('id','CLASS-CUSTOM-'||r.id,'group',r."group",'lesson',r.lesson,
  'question',r.question,'options',to_jsonb(r.options),'correct',r.correct,'source','class-custom','source_id',r.id)
 from public.ikigai_room_questions r where r.room='class' and r."group" in ('vocabulary','grammar','kanji')
)
select id,q->>'group' as category,
 concat_ws(E'\n\n',nullif(q->>'prefix',''),q->>'question') as prompt,
 q->'options' as options,strpos('ABCD',q->>'correct')-1 as correct,
 q->>'image' as image,q->>'image_alt' as image_alt,q
from merged where q->>'group' in ('vocabulary','grammar','kanji')
 and q->>'correct' ~ '^[ABCD]$' and jsonb_typeof(q->'options')='array'
 and jsonb_array_length(q->'options')=4 and length(trim(q->>'question'))>0
 and (select count(distinct trim(value)) from jsonb_array_elements_text(q->'options'))=4;
revoke all on ikigai_ranked.classroom_questions from public,anon,authenticated;

create or replace function public.ikigai_classroom_arena_bank() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null then raise exception 'Sign-in required'; end if;
 return coalesce((select jsonb_agg(q || jsonb_build_object('question',prompt,'correct',substr('ABCD',correct+1,1),'options',options) order by id)
   from ikigai_ranked.classroom_questions),'[]'::jsonb);
end $$;
revoke all on function public.ikigai_classroom_arena_bank() from public,anon;
grant execute on function public.ikigai_classroom_arena_bank() to authenticated;

create table if not exists ikigai_ranked.bunpou_questions (
 id text primary key,lesson integer not null,parts jsonb not null check(jsonb_typeof(parts)='array')
);
create table if not exists ikigai_ranked.bunpou_attempts (
 player uuid not null references auth.users(id) on delete cascade,
 run uuid not null,question text not null references ikigai_ranked.bunpou_questions(id),
 correct boolean not null,earned integer not null check(earned in (0,10)),
 answered_at timestamptz not null default now(),primary key(player,run,question)
);
alter table ikigai_ranked.bunpou_questions enable row level security;
alter table ikigai_ranked.bunpou_attempts enable row level security;
revoke all on ikigai_ranked.bunpou_questions,ikigai_ranked.bunpou_attempts from public,anon,authenticated;

-- Match the game's accepted independent phrases as well as canonical word order.
create or replace function ikigai_ranked.bunpou_parts_correct(canonical jsonb,answer jsonb)
returns boolean language plpgsql immutable security invoker set search_path=pg_catalog as $$
declare c text[];a text[];n integer;
begin
 if jsonb_typeof(answer) is distinct from 'array' then return false;end if;
 if answer=canonical then return true;end if;
 select array_agg(x order by i) into c from jsonb_array_elements_text(canonical) with ordinality t(x,i);
 select array_agg(x order by i) into a from jsonb_array_elements_text(answer) with ordinality t(x,i);
 n:=cardinality(c);
 if n<3 or cardinality(a)<>n or a[n]<>c[n] then return false;end if;
 if (select array_agg(x order by x) from unnest(a[1:n-1]) t(x)) is distinct from
    (select array_agg(x order by x) from unnest(c[1:n-1]) t(x)) then return false;end if;
 return not exists(select 1 from unnest(c[1:n-1]) t(x) where not (
  x ~ '^(わたしは|たなかさんは|きのう|きょう|あした|まいにち|いま|いっしょに|もう)$'
  or (x ~ '(で|へ|に|を|と|が)$' and x !~ '(てから|とき|から|より|たら|ても|なければ|ては|ことが)$')));
end $$;
revoke all on function ikigai_ranked.bunpou_parts_correct(jsonb,jsonb) from public,anon,authenticated;

create or replace function public.ikigai_bunpou_answer(p_run uuid,p_question text,p_parts jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare who uuid:=auth.uid();canonical jsonb;ok boolean;award integer:=0;total_xp integer;already boolean:=false;
begin
 if who is null then raise exception 'Sign-in required';end if;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or coalesce(auth.jwt()->'app_metadata'->>'role','')='teacher'
  then return jsonb_build_object('guest',true,'earned',0);end if;
 if p_run is null or length(p_question)>120 or coalesce(pg_column_size(p_parts),0)>8000 then raise exception 'Invalid answer';end if;
 select parts into canonical from ikigai_ranked.bunpou_questions where id=p_question;
 if canonical is null then raise exception 'Unknown Bunpou question';end if;
 if not exists(select 1 from public.ikigai_world_profiles where user_id=who and role='student')
  then raise exception 'Student account required';end if;
 ok:=ikigai_ranked.bunpou_parts_correct(canonical,p_parts);award:=case when ok then 10 else 0 end;
 insert into ikigai_ranked.bunpou_attempts(player,run,question,correct,earned) values(who,p_run,p_question,ok,award)
 on conflict(player,run,question) do nothing;
 if not found then already:=true;award:=0;
 else update public.ikigai_world_profiles set xp=xp+award,updated_at=now() where user_id=who;end if;
 select xp into total_xp from public.ikigai_world_profiles where user_id=who;
 return jsonb_build_object('correct',ok,'earned',award,'xp',total_xp,'duplicate',already);
end $$;
revoke all on function public.ikigai_bunpou_answer(uuid,text,jsonb) from public,anon;
grant execute on function public.ikigai_bunpou_answer(uuid,text,jsonb) to authenticated;
