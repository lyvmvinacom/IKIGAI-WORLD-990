# Official IKIGAI wallet, inventory and cosmetics

The Shop uses the signed-in student's existing `ikigai_world_profiles.coins`.
Purchasing adds permanent ownership; pressing **Trang bị** changes the active
character or pet. The original locked avatar remains available in the Bag.
Purchased characters and pets are cosmetic and do not change XP or study results.

## Server authority

`live-schema.sql` is the additive migration installed in Supabase, followed by
`realtime.sql`. Do not rerun the initial migration against an installed schema.
Inventory, equipment, catalog and ledger are private. Authenticated RPCs validate
the current user, student role, published catalog price, funds and ownership.
Purchases lock the existing wallet row and deduct coins, grant ownership and
write the ledger atomically. Duplicate requests return the existing purchase.
No client-side wallet update or browser storage grants ownership.

`ikigai_world_cosmetics` exposes only the user ID and equipped item IDs for
rendering. Clients can read it but cannot write it. Changes are delivered through
Realtime with a polling fallback. `world.js` resolves public appearances from this
table rather than trusting appearance IDs received through player presence.

## Game integration

`world.js` owns the authenticated connection in the parent game. `ui.js` uses a
same-origin parent bridge; the embedded Shop receives no session tokens. Failed
or uncertain requests reload server state before allowing another operation.
Guests may preview art but cannot buy or equip. Teachers retain their existing
appearance. A selected pet follows its player's existing movement container.

Equipped art is used in existing room actors, arena players, online thumbnails,
leaderboard portraits and the player's map HUD. Existing scenery-only map and
classroom rules and fixed NPC appearances remain intact. HD sprites, background,
pedestal alignment, idle animations, landscape handling and descending price
order are retained.

## Verification

`tests/shop-transactions.sql` runs inside an explicit transaction with a student
UUID supplied as `test.shop.user_id`; always roll it back on production. It checks
purchase, duplicate requests, server prices, ownership, equipment, removal,
wallet/XP accounting and access restrictions.

The `Live shop transaction checks` GitHub Actions workflow uses a disposable
PostgreSQL service and fixture account. It also runs two simultaneous purchase
requests alongside a wallet reward, verifying exactly one debit, plus existing
JFT/Hyogen regression tests. Fixture data and mock browser SDKs must never be
installed in production.
