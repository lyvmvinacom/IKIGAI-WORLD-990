# IKIGAI SHOP — stage 2 draft

Disabled; no production migration or frontend changes. Catalog prices and names provisional; verify asset paths against stage 1 archive before publishing.

Existing wallet: public.ikigai_world_profiles.coins. Existing quiz RPC awards 2 coins/correct capped at 40 per submission. Do not replace reward RPC or change learning data.

Design: separate catalog, ownership (unique user/item), equipment (one character and one pet per user), purchase ledger. Purchase must be server-authoritative, atomic, lock wallet row, check item published and ownership, deduct balance and insert ownership and ledger in one transaction. Equip only owned items; null restores legacy avatar or removes pet. RLS owner-only for inventory and ledger; no direct client writes. Shop disabled until reward abuse controls and regression tests are verified.

Tests required: concurrent purchase, duplicate purchase, insufficient balance, unpublished item, cross-user access, equip unowned item, simultaneous quiz reward and purchase, legacy avatar fallback, unchanged learning progress and EXP. No deployment yet.
