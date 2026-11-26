# Permanent event reward assets

| Item | ID | Sprite |
| --- | --- | --- |
| Akatsuki | VIP025 | shop/sprites/VIP025.png |
| Cáo Linh Hỏa Vàng | PET011 | shop/sprites/PET011.png |
| Cáo Linh Hỏa Bạc | PET012 | shop/sprites/PET012.png |
| Cáo Linh Hỏa Đồng | PET013 | shop/sprites/PET013.png |

All are unpublished, event-only catalog items. The purchase endpoint rejects them. The normal shop catalog remains unchanged; owned event items are returned separately in `reward_catalog`. The inventory UI merges that field for equipping and explicitly excludes event items from the Shop view, including for owners. Old clients ignore the new field safely.

Database setup: `database/event-reward-items.sql`. No player inventory or wallet is changed by setup. Reward grants are a separate operation after reviewing winners. The legacy catalog price placeholder is never exposed as a sale price: owned rewards return `price:0` and `event_only:true`.

Original approved character and fox designs were used as references. Sprites were prepared with built-in image generation, preserving complete bodies, removing poster text and using alpha transparency. The selected Akatsuki prompt requested faithful silver hair, kitsune mask, navy/red/gold outfit and a clean full-body cutout. Fox prompts preserved each approved gold/silver/bronze variant, single tail, scarf, infinity medallion and left-facing pose.

Regression checks: `node --test tests/event-reward-ui.test.mjs`; database checks `tests/event-reward-items.sql` use rollback-only ownership/equipment fixtures.
