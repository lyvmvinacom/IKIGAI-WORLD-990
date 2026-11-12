# IKIGAI EDUCATION N4 mock exams

This module opens inside the existing N4 game room. It uses the existing IKIGAI account and private Supabase question bank/media bucket; no second site or sign-in is required.

Questions and choices render as text. The notation `{漢字|かんじ}` displays ruby above the kanji, and `[[text]]` preserves underlining. Only furigana present in the supplied source is transcribed. Kanji-reading questions do not gain answer readings. All imported text is escaped; arbitrary HTML is never rendered. Diagrams and tables remain original private images, with crop metadata and a large reader.

The reading layout uses the game container's logical dimensions, including the existing portrait-to-landscape rotation. Short choices remain visible with timer and navigation. Longer passages scroll separately. A−/A+ persists the chosen size locally, and the large reader provides image zoom while the timer continues. Teacher editing supports question text, choices, source furigana notation, and passage text.

Private exam content, answer keys, PDF crops and original MP3s are deliberately excluded from this repository. The server verifies ownership, saves answers, locks completed phases and grades attempts. Database definitions are in `database/n4_mock_exams.sql`, `database/n4_private_media.sql` and `database/n4_display_fields.sql`.

N4 practice score: language knowledge plus reading 0–120, listening 0–60, total 0–180. IKIGAI's linear practice conversion is explicitly distinguished from official JLPT scaled scoring. Display updates do not modify answer keys, EXP, attempt answers, timers or completed results.
