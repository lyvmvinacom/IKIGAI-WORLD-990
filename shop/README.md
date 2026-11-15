# IKIGAI EDUCATION · Shop and Inventory

Work branch: `ikigai-shop-stage2`. Keep `main` and learning features unchanged.

## Completed interface

- 24 VIP character PNGs, 10 pet PNGs, Shop and Bag map icons, and palace background under `shop/`.
- The 10 existing free character images are reused from `assets/characters/`.
- Shop and shared Character/Bag tabs include selection, previews, ownership labels, confirmation, equip/remove pet, and empty states.
- Landscape phone layout uses a separately scrolling grid. Portrait prompts rotation.
- Map icons open an iframe overlay; close button or Escape (including inside the iframe) returns focus to the originating icon.

## Test balance, not live account balance

`demo.html` is a frontend preview. It begins with 35,000 **test coins**, persists purchases/equipment within the same browser-tab session, and never calls production wallet, inventory, reward, EXP, or learning APIs. Test equipment is displayed within the preview, not applied to live world avatars. Closing the tab ends the test session.

`catalog.draft.json` remains disabled and unpublished. `stage2.sql` is a proposed server-authoritative shop schema tested with an isolated PostgreSQL fixture by `.github/workflows/shop-test.yml`; it has not been installed into production by this change. Publishing live items and connecting authenticated purchase/equip RPCs remain a separate integration step.

## Verification, 16 November 2026 (Vietnam time)

- Uploaded asset commit: `9a48897c52aa36794885d5c43e5498d47f52fac5`. All 37 local PNGs match the uploaded ZIP bytes.
- Existing PostgreSQL workflow at that commit: success, run `43747353667`.
- Browser checks passed: free characters load; empty pet inventory; 24 characters and 10 pets; cancel purchase preserves 35,000; buy VIP001 reduces to 32,000; equip blocks another purchase; buy PET001 reduces to 28,000; equip/remove pet; 30,000-price item disabled at 28,000; inventory contains the purchased item; reload retains balance and equipment.
- Checked desktop and 844 × 390 landscape iframe. Fixed grid rows compressing and hiding item names/prices. Tested map launcher in an isolated map fixture: both entry points, close button, Escape from iframe, and focus restoration.
- JavaScript syntax checked with Node. Full authenticated game regression and production purchase flows have not been exercised; no production database changes were made.
