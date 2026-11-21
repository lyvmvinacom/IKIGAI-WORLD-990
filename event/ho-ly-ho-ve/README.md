# Hồ Ly Hộ Vệ · 2026

Independent optional event module on branch `event/ho-ly-ho-ve-20261122`.

- Accounting: **21 November 2026 17:00 inclusive → 25 November 2026 00:00 exclusive**, Asia/Ho_Chi_Minh.
- Announcement intentionally remains **22 November 00:00 → 24 November 24:00**, as requested.
- One board for registered students at every level. Positive server reward receipts only; teacher/manual wallet grants never enter this board.
- Sources: `ikigai_rewards_private.policy_attempts` (all current learning/game rewards) and settled ranked arena rewards. Do not also sum legacy result tables: they mirror these receipts and would double count.
- Sort: event EXP descending, last positive award time ascending, UUID as deterministic fallback for identical timestamps. Zero EXP has no rank.
- Server controls time and eligibility; browser polls every 10 seconds only while the panel is open and the page is visible.
- Existing five lifetime reward attempts and minimum 50% result rules remain unchanged. No new rewards are minted by viewing the event.
- At the end, later rewards are excluded and the panel becomes “Đã kết thúc · Kết quả chờ kiểm tra”. Award distribution is manual after reviewing the winners; this module does not grant prizes automatically.

## Install and verify

Apply `database/event-ho-ly-ho-ve.sql` through the database migration tool. Verify with `tests/event-ho-ly-ho-ve.sql` (rollback-only fixtures).

## Remove from the game

Remove `<script src="event/ho-ly-ho-ve/event.js?v=20261121-2-badge"></script>` from `index.html` and update its app cache version. The optional `IKIGAI_FOX_EVENT?.init` hook does nothing without that script. The event button, panel and stylesheet disappear together. Remove the optional hook and `event/ho-ly-ho-ve/` files when cleaning up.

Keep the read-only database function for reviewing historical results, or separately revoke `EXECUTE` on `public.ikigai_event_ho_ly_state()` from `authenticated`. No trigger, cron job, wallet modification or event table needs removal. Removing a Git branch alone does not remove deployed UI.
