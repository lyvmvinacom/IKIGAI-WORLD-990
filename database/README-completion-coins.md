# Completion coins

Approved 2026-11-17: full practice = 50 coins; a submitted examination = 200 coins.
The existing EXP formulas are unchanged. Reading instructions, opening a lesson,
abandoning a practice early, and guest/teacher sessions do not receive completion coins.

| Receipt | Coins | Completion proof |
| --- | ---: | --- |
| General classroom quiz / Kanji bomb | 50 | Saved quiz attempt |
| Kotoba Ninja | 50 | All registered words have saved answer events |
| Bunpou Tetris | 50 | All 30 registered questions have saved answer events |
| Verb conjugation | 50 | Registered ten-question run and ten answers |
| JFT vocabulary / Kanji / Hyogen practice | 50 | Saved server-graded attempt with no unanswered items |
| Legacy timed JFT Hyogen test | 200 | Saved timed-test attempt |
| JFT mock exam | 200 | Saved server-graded examination |
| N4 mock exam | 200 | Final result saved on the server |
| Minna grammar test | 200 | Saved test submission |
| General mock exam | 200 | Saved examination receipt |

`completion-coins.sql` installs the ledger, APIs, and automatic completion hooks.
`verb-reward-keys.sql` seeds canonical question IDs from the approved verb bank.
`completion-coins-backfill.sql` records the explicitly authorized historical batch:
173 JFT practice attempts, eight students, 8,650 coins. It reuses the same receipt
keys as future claims, so refreshing the UI or rerunning the batch cannot pay twice.
Original quiz reward rows and EXP records remain unchanged.

The deployed policy timestamp excludes automatic historical credits. The private
batch manifest retains per-account wallet/EXP baselines used to verify the backfill.
Newly finished tests are credited atomically with their result. Registered vocabulary
and Bunpou runs are credited with their last saved answer even if the UI is closed.

Verification: `node --test tests/*.test.mjs`; run `tests/completion-coins.sql` against
the seeded database. Its integration checks end with ROLLBACK and cover completion,
incomplete work, cross-account receipts, retries, and all supported result triggers.
