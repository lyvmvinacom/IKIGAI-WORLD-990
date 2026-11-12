# IKIGAI N4 mock exams — staged review

Do not merge or activate before IKIGAI approves the supplied UI screenshots.

- Three source tests: 35 vocabulary, 35 grammar/reading, 28 listening each.
- Source questions are individually cropped to preserve exact Japanese, ruby and diagrams. Related passages are attached to their own questions.
- 294 answers checked against filled answer sheets, with an independent optical-mark comparison.
- Written section timing: 25 + 55 minutes. Listening uses each supplied complete recording (36:56.542, 40:53.107, 39:15.304) plus 10 seconds for final selection.
- Formula: round(written correct / 70 * 120) + round(listening correct / 28 * 60). Pass requires 90 total, 38 written, 19 listening. Labels explicitly say internal practice scoring, not JLPT scaled scores.
- Private server records freeze a per-attempt exam snapshot. Teacher edits affect new attempts. Existing EXP is never modified.
- Only non-anonymous authenticated users may take tests. Only verified app_metadata.role=teacher may edit. Answers and source explanations are returned only in completed-attempt review (or teacher management).
- Audio and images must be uploaded to private bucket ikigai-n4-media under n4/; client signs URLs for 3 hours. Do not put book media or keys in the public GitHub repository.
- Apply database/n4_mock_exams.sql and database/n4_private_media.sql only when approved; then import each bank.private.json object into ikigai_n4_private.exams. Never publish bank.private.json, demo-adapter.js or a preview dist/ directory.
- The source bank and cropped images are retained as a separate private data artifact; original MP3s remain in the supplied files.

Validated locally: real PostgreSQL engine (PGlite), max/min/section-fail grades, answer-key redaction, teacher-only data, single listening start, browser flow and 844×390 / 667×320 layouts. Production activation remains pending approval.
