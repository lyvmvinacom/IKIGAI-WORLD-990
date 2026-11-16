do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ikigai_world_cosmetics') then
  alter publication supabase_realtime add table public.ikigai_world_cosmetics;
 end if;
end $$;
