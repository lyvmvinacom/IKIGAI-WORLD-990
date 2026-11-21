-- Restrict unauthenticated API access; signed-in anonymous guests retain their authenticated role.
REVOKE EXECUTE ON FUNCTION public.can_view_room_members(uuid),public.get_ikigai_leaderboard(),public.ikigai_ensure_profile(text,text,integer,integer,integer),public.ikigai_world_leaderboard(),public.submit_ikigai_attempt(uuid[],integer[],text,integer,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_view_room_members(uuid),public.get_ikigai_leaderboard(),public.ikigai_ensure_profile(text,text,integer,integer,integer),public.ikigai_world_leaderboard(),public.submit_ikigai_attempt(uuid[],integer[],text,integer,uuid) TO authenticated;
-- Preserve existing RLS predicates; evaluate stable auth claims once per statement.
ALTER POLICY "Players can create rooms" ON public."game_rooms" WITH CHECK ((created_by = (select auth.uid())));
ALTER POLICY "Room members can view rooms" ON public."game_rooms" USING (((created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM room_members rm
  WHERE ((rm.room_id = game_rooms.id) AND (rm.player_id = (select auth.uid())))))));
ALTER POLICY "Room owners can update rooms" ON public."game_rooms" USING ((created_by = (select auth.uid()))) WITH CHECK ((created_by = (select auth.uid())));
ALTER POLICY "students read assignments" ON public."ikigai_assignments" USING (((assigned_to IS NULL) OR ((select auth.uid()) = ANY (assigned_to))));
ALTER POLICY "teacher manage assignments" ON public."ikigai_assignments" USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'teacher'::text)) WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'teacher'::text));
ALTER POLICY "students read own attempts" ON public."ikigai_attempts" USING (((select auth.uid()) = user_id));
ALTER POLICY "teacher read all attempts" ON public."ikigai_attempts" USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'teacher'::text));
ALTER POLICY "grammar_edits_read" ON public."ikigai_grammar_question_edits";
ALTER POLICY "grammar_edits_teacher_insert" ON public."ikigai_grammar_question_edits";
ALTER POLICY "grammar_results_own_insert" ON public."ikigai_grammar_results";
ALTER POLICY "grammar_results_own_select" ON public."ikigai_grammar_results";
ALTER POLICY "hyogen_progress_insert" ON public."ikigai_hyogen_progress";
ALTER POLICY "hyogen_progress_select" ON public."ikigai_hyogen_progress";
ALTER POLICY "jft_drill_own_results" ON public."ikigai_jft_drill_results" USING (((user_id = ( SELECT auth.uid() AS uid)) AND (COALESCE(((select auth.jwt()) ->> 'is_anonymous'::text), 'false'::text) <> 'true'::text)));
ALTER POLICY "jft_drills_members" ON public."ikigai_jft_drill_sets" USING ((((select auth.uid()) IS NOT NULL) AND (COALESCE(((select auth.jwt()) ->> 'is_anonymous'::text), 'false'::text) <> 'true'::text)));
ALTER POLICY "teacher_read_diary" ON public."ikigai_learning_diary" USING (((( SELECT (((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text)) = 'teacher'::text) AND (NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false))));
ALTER POLICY "questions read active" ON public."ikigai_questions" USING ((active OR ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'teacher'::text)));
ALTER POLICY "teacher manage questions" ON public."ikigai_questions" USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'teacher'::text)) WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'teacher'::text));
ALTER POLICY "room_questions_read" ON public."ikigai_room_questions";
ALTER POLICY "room_questions_teacher_insert" ON public."ikigai_room_questions" WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'teacher'::text));
ALTER POLICY "room_questions_teacher_update" ON public."ikigai_room_questions" USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'teacher'::text)) WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'teacher'::text));
ALTER POLICY "students manage own profile" ON public."ikigai_student_profiles" USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "teacher read student profiles" ON public."ikigai_student_profiles" USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'teacher'::text));
ALTER POLICY "cosmetic_display" ON public."ikigai_world_cosmetics";
ALTER POLICY "Authenticated users view Hall of Fame" ON public."ikigai_world_hall_of_fame";
ALTER POLICY "Player reads own profile" ON public."ikigai_world_profiles" USING (((select auth.uid()) = user_id));
ALTER POLICY "Teachers read all profiles" ON public."ikigai_world_profiles" USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'teacher'::text));
ALTER POLICY "Player reads own quiz attempts" ON public."ikigai_world_quiz_attempts" USING (((select auth.uid()) = user_id));
ALTER POLICY "Authenticated users can view profiles" ON public."player_profiles";
ALTER POLICY "Players can create own profile" ON public."player_profiles" WITH CHECK (((select auth.uid()) = id));
ALTER POLICY "Players can update own profile" ON public."player_profiles" USING (((select auth.uid()) = id)) WITH CHECK (((select auth.uid()) = id));
ALTER POLICY "Players can add own attempts" ON public."quiz_attempts" WITH CHECK ((player_id = (select auth.uid())));
ALTER POLICY "Players can view own attempts" ON public."quiz_attempts" USING ((player_id = (select auth.uid())));
ALTER POLICY "Members can view room members" ON public."room_members";
ALTER POLICY "Players can join as themselves" ON public."room_members" WITH CHECK (((player_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM game_rooms r
  WHERE ((r.id = room_members.room_id) AND (r.is_active = true))))));
ALTER POLICY "Players can leave their own room" ON public."room_members" USING ((player_id = (select auth.uid())));
-- Index missing FK columns and frequent task/history queries; no existing indexes dropped.
CREATE INDEX IF NOT EXISTS "idx_fk_audio_updates_updated_by" ON "ikigai_jft_scores"."audio_updates" ("updated_by");
CREATE INDEX IF NOT EXISTS "idx_fk_exam_access_updated_by" ON "ikigai_jft_scores"."exam_access" ("updated_by");
CREATE INDEX IF NOT EXISTS "idx_fk_exam_details_updated_by" ON "ikigai_jft_scores"."exam_details" ("updated_by");
CREATE INDEX IF NOT EXISTS "idx_fk_furigana_overlays_updated_by" ON "ikigai_jft_scores"."furigana_overlays" ("updated_by");
CREATE INDEX IF NOT EXISTS "idx_fk_results_exam_id" ON "ikigai_jft_scores"."results" ("exam_id");
CREATE INDEX IF NOT EXISTS "idx_fk_text_overlays_updated_by" ON "ikigai_jft_scores"."text_overlays" ("updated_by");
CREATE INDEX IF NOT EXISTS "idx_fk_attempts_exam_id" ON "ikigai_n4_private"."attempts" ("exam_id");
CREATE INDEX IF NOT EXISTS "idx_fk_bunpou_attempts_question" ON "ikigai_ranked"."bunpou_attempts" ("question");
CREATE INDEX IF NOT EXISTS "idx_fk_backfill_jft_173_user_id" ON "ikigai_rewards_private"."backfill_jft_173" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_fk_equipment_item_id_kind" ON "ikigai_shop_private"."equipment" ("item_id","kind");
CREATE INDEX IF NOT EXISTS "idx_fk_equipment_user_id_item_id" ON "ikigai_shop_private"."equipment" ("user_id","item_id");
CREATE INDEX IF NOT EXISTS "idx_fk_inventory_item_id" ON "ikigai_shop_private"."inventory" ("item_id");
CREATE INDEX IF NOT EXISTS "idx_fk_ledger_item_id" ON "ikigai_shop_private"."ledger" ("item_id");
CREATE INDEX IF NOT EXISTS "idx_fk_assignments_created_by" ON "ikigai_tasks_private"."assignments" ("created_by");
CREATE INDEX IF NOT EXISTS "idx_fk_game_rooms_created_by" ON "public"."game_rooms" ("created_by");
CREATE INDEX IF NOT EXISTS "idx_fk_ikigai_assignments_created_by" ON "public"."ikigai_assignments" ("created_by");
CREATE INDEX IF NOT EXISTS "idx_fk_ikigai_attempts_assignment_id" ON "public"."ikigai_attempts" ("assignment_id");
CREATE INDEX IF NOT EXISTS "idx_fk_ikigai_grammar_question_edits_updated_by" ON "public"."ikigai_grammar_question_edits" ("updated_by");
CREATE INDEX IF NOT EXISTS "idx_fk_ikigai_grammar_results_user_id" ON "public"."ikigai_grammar_results" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_fk_ikigai_world_cosmetics_user_id_character_id" ON "public"."ikigai_world_cosmetics" ("user_id","character_id");
CREATE INDEX IF NOT EXISTS "idx_fk_ikigai_world_cosmetics_user_id_pet_id" ON "public"."ikigai_world_cosmetics" ("user_id","pet_id");
CREATE INDEX IF NOT EXISTS "idx_fk_ikigai_world_quiz_attempts_user_id" ON "public"."ikigai_world_quiz_attempts" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_fk_quiz_attempts_room_id" ON "public"."quiz_attempts" ("room_id");
CREATE INDEX IF NOT EXISTS policy_attempts_user_lesson_time_idx ON ikigai_rewards_private.policy_attempts(user_id,source,lesson_key,created_at DESC);
CREATE INDEX IF NOT EXISTS assignments_active_student_due_idx ON ikigai_tasks_private.assignments(student_id,due_at,created_at DESC) WHERE active;
CREATE INDEX IF NOT EXISTS grammar_results_user_test_recent_idx ON public.ikigai_grammar_results(user_id,test_id,created_at DESC);
NOTIFY pgrst,'reload schema';