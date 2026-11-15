-- Existing RLS restricts these rows to non-anonymous teachers. No access policies or grants change.
alter publication supabase_realtime add table public.ikigai_learning_diary;
