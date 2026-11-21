REVOKE EXECUTE ON FUNCTION public.ikigai_kanji_bomb_finish(integer,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
REVOKE UPDATE,DELETE ON public.ikigai_grammar_results FROM anon,authenticated;
NOTIFY pgrst,'reload schema';