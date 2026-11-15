# Hyogen practice

The JFT room's existing Hyogen button now routes to `hyogen.js`. Kanji and vocabulary keep their existing routes. The prior Hyogen bank remains reachable through the legacy-bank button.

- 30 original learning dialogues with 30 changed-dialogue counterparts.
- 60 separate practice dialogues, in five stable 12-question sets.
- No inferred setting, intent labels or explanations appear before an answer. Learning requests evidence directly from the dialogue after locking the answer. Practice explanations unlock only after submission.
- Stable source option indexes are retained when both question order and displayed options are shuffled. RPC submission is converted back to the canonical set order.
- Practice attempts, question-level mistakes and lesson completion synchronize per account in `ikigai_hyogen_progress`, with a local pending-write cache and retry. Only practice uses the existing server-scored EXP RPC. New-encounter accuracy is reported separately from repeat questions.
- Review prefers unseen material in the same communication group; it falls back to the original item when none remains. Group summaries describe observed errors, not a diagnostic assessment.

Apply `database/hyogen_progress.sql` once. `node database/seed-hyogen.mjs` prints non-overwriting SQL to seed the five practice sets. Do not edit their correct indexes independently of the source bank.

Validation: `node --test tests/hyogen.test.mjs` and JavaScript syntax checks. Browser QA covered learning, direct evidence selection, changed dialogues, mistake lists, a shuffled 12-question submission, and an 844-by-390 landscape game canvas. The database grading/RLS check ran against temporary fixture rows in a rolled-back subtransaction: own progress, cross-user write denial, 12/12 server scoring, same-attempt retry, and no extra EXP on a repeat perfect score.
