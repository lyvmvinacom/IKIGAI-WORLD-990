# IKIGAI WORLD 9.2 — True Layered Map

Bản nâng cấp dựa trên mã nguồn IKIGAI WORLD 9.0/9.1 được cung cấp.

## Thay đổi chính
- Bản đồ ngoài được render bằng 7 ảnh layer PNG độc lập trong `assets/map-layers/`.
- 7 công trình được render bằng 7 ảnh PNG trong `assets/buildings/`, không gộp vào ảnh nền.
- Các hotspot HTML vẫn độc lập và gọi logic mở phòng hiện có.
- Ảnh bản đồ tổng hợp `ikigai-world-map-v9.png` chỉ được giữ làm ảnh tham khảo, không được dùng làm nền khi render.
- Giữ nguyên `app.js`, đăng nhập/Supabase, chat, nhân vật, nội dung phòng và dữ liệu câu hỏi của gói nguồn, ngoại trừ thay cache-busting và tiêu đề phiên bản.

## Thứ tự layer
1. `01_terrain.png`
2. `02_water.png`
3. `03_paths_plaza.png`
4. `04_entrance_gate.png`
5. `05_vegetation.png`
6. `06_lanterns_bridges_props.png`
7. 7 công trình độc lập trong `assets/buildings/`
8. `07_atmosphere_effects.png`

## Cài đặt
Giải nén ZIP và triển khai toàn bộ nội dung thư mục `ikigainohongo-main` lên GitHub Pages. Giữ nguyên cấu trúc thư mục.

## Lưu ý
Các layer PNG hiện tại được kế thừa từ bộ tài nguyên tách kỹ thuật của bản nguồn, không phải toàn bộ được vẽ mới theo phong cách game thương mại. Bản 9.2 sửa việc CSS dùng ảnh composite và ẩn layer; nó chưa tạo hoạt ảnh độc lập cho từng vật thể. Gói nguồn không có `assets/jft/`; nếu dự án GitHub hiện tại đang có thư mục này thì cần giữ lại khi cập nhật.


## Bản 9.2.1 — bản đồ layer độc lập

- Bản đồ dùng 7 PNG riêng trong `assets/map-layers/` và 7 công trình riêng trong `assets/buildings/`.
- `assets/map-layers/manifest.json` mô tả thứ tự ghép từ dưới lên trên.
- Không dùng `ikigai-world-map-v9.png` làm nền hiển thị.
- Khi cập nhật GitHub, hãy **gộp (merge) thư mục `assets`** để giữ các tài nguyên khác như `assets/jft/` nếu repository đang có.


## IKIGAI WORLD 9.2.2 — Layered Map Repair

- Bản đồ ghép trực tiếp từ 7 PNG độc lập trong `assets/map-layers/` và 7 PNG công trình trong `assets/buildings/`.
- Manifest duy nhất: `assets/map-layers/manifest.json`.
- Các bản sao layer bị đặt nhầm trong `assets/buildings/` đã được dọn.
- CSS layered-map cũ bị nối lặp đã được thay bằng một khối quy tắc duy nhất.


## Bản đồ 9.2.3
- Background mới: `assets/ikigai-world-background-no-buildings.png` (3840x2160 (4K UHD)).
- 7 công trình PNG độc lập trong `assets/buildings/`, có thể thay đổi vị trí/kích thước bằng CSS.
- Bố cục canvas 1672x941, các hotspot tương ứng vẫn hoạt động.


## IKIGAI WORLD 9.3 – Living Sakura World
- Bổ sung `canvas#ambientCanvas` độc lập, phủ hiệu ứng trang trí lên bản đồ.
- Script hiệu ứng nằm riêng trong `ambient-effects.js`.
- Hiệu ứng hoa anh đào rơi, thác nước lấp lánh, đài phun nước và ánh nước mặt hồ.
- Canvas không chặn thao tác bấm công trình; tự dừng khi vào phòng hoặc chuyển tab.


## IKIGAI WORLD 9.9.0 — Mobile Stability Audit

- Consolidated portrait-phone room rotation into one authoritative CSS block.
- Matched interior room rotation to the map's `rotate(90deg)` direction.
- Removed obsolete 9.8.0/9.8.2 mobile root-rotation blocks that contradicted later rules.
- Retained the classroom-specific board, seat and artwork rules.
- Added explicit unrotated behavior for landscape phones.
- Restored browser pinch-zoom accessibility and prevented iOS input auto-zoom.
- Removed two 1-byte unused placeholder files.
- Cache-busted CSS and JavaScript assets.


## IKIGAI WORLD 10.0.0 — Clean Classroom UI

- Rebuilt the classroom DOM into independent board regions: heading, question, scrollable answers, feedback, and fixed footer action.
- Removed classroom-specific rules from the accumulated base stylesheet and moved the classroom design into `classroom.css` as a single source of truth.
- The classroom header is removed from document flow, so the illustration fills the room viewport; Chat and Back controls remain accessible overlays.
- Classroom participant sprites are not rendered. Presence/chat behavior outside the classroom remains unchanged.
- Preserved the existing portrait-phone 90-degree world rotation by design.
- Preserved Supabase URL/anon configuration, schema, learning banks, audio assets, ambient effects, and all non-classroom rooms.


## IKIGAI WORLD 10.3.9 — Unified Landscape Mode

- The entire application canvas (`#game`) is rotated as one unit on portrait-held phones, rather than rotating the map, room, or individual overlays separately.
- Login, map, classroom, exam rooms, arena, chat, dialogs, activities, toast notifications, and the music control now share the same landscape coordinate system.
- Removed double-rotation behavior from the map and room viewport by overriding their former portrait transforms.
- Kept arena joystick screen-direction mapping for the rotated canvas; on portrait-held phones its local bottom-right maps to the physical bottom-left.
- Added a best-effort native Screen Orientation landscape lock when the page is already fullscreen. CSS landscape-canvas rotation remains the fallback.
- Native landscape phones/tablets retain the unrotated layout.
