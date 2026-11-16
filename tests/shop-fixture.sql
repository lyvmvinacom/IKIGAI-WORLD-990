create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb $$;
grant usage on schema auth to authenticated;
grant execute on all functions in schema auth to authenticated;
create table public.ikigai_world_profiles(user_id uuid primary key,nickname text,role text,gender text,avatar int,xp int,coins int,updated_at timestamptz default now());
insert into public.ikigai_world_profiles values('00000000-0000-4000-8000-000000000001','Shop CI','student','male',0,123,50000,now());
