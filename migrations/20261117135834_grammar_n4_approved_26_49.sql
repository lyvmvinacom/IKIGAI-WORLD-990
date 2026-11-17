-- Extend the existing grammar test identifiers to include the 12 approved N4 tests.
-- Existing results, edits, scoring checks, and RLS policies remain intact.
set local lock_timeout = '5s';
set local statement_timeout = '30s';
alter table public.ikigai_grammar_results
  drop constraint ikigai_grammar_results_test_id_check,
  drop constraint grammar_v4_test_id,
  add constraint ikigai_grammar_results_test_id_check
    check (test_id ~ '^grammar-(0[1-9]|1[0-9]|2[0-4])$'),
  add constraint grammar_v4_test_id
    check (test_id ~ '^grammar-(0[1-9]|1[0-9]|2[0-4])$') not valid;
alter table public.ikigai_grammar_results validate constraint grammar_v4_test_id;
alter table public.ikigai_grammar_question_edits
  drop constraint ikigai_grammar_question_edits_test_id_check,
  add constraint ikigai_grammar_question_edits_test_id_check
    check (test_id ~ '^grammar-(0[1-9]|1[0-9]|2[0-4])$');
