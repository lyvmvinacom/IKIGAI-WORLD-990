create role anon nologin;
create role authenticated nologin;
create schema auth;
grant usage on schema auth to authenticated;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
create table public.ikigai_world_profiles(user_id uuid primary key, role text not null, coins integer not null, xp integer not null);
insert into public.ikigai_world_profiles values ('00000000-0000-4000-8000-000000000001','student',4000,123);
