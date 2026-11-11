# Cập nhật 12 đề ngữ pháp IKIGAI

Gói này nối tiếp `IKIGAI_GRAMMAR_12_TESTS_PROGRESS_197.zip`. Gói giữ đủ 197 mã câu cũ, bổ sung ngân hàng đối chiếu Word riêng và sửa phần hiển thị, chấm điểm, lưu kết quả. Không phải bản mã nguồn toàn bộ IKIGAI WORLD.

1. Giải nén vào một thư mục riêng. Sao lưu phiên bản website đang dùng.
2. Trong Supabase SQL Editor, chạy `SUPABASE_GRAMMAR_RESULTS_MIGRATION.sql`. Tệp bỏ cả giới hạn `total_count = 3` và `correct_count <= 3` của bản xem trước, thêm mã lượt làm và phiên bản ngân hàng. Không xóa lịch sử. Kiểm tra hai bảng kết quả truy vấn cuối tệp.
3. Chép đè **ba tệp** `grammar-tests.json`, `grammar-tests.js`, `grammar-tests.css` vào thư mục gốc website; chép thêm toàn bộ thư mục `grammar-assets`.
4. Trong `index.html` hiện đang dùng, đổi phần phiên bản của hai liên kết hiện có thành `grammar-tests.css?v=20261111-644` và `grammar-tests.js?v=20261111-644`. Giữ nguyên các phần khác của trang. Gói không chép đè `app.js` hoặc `index.html` từ bản tiến độ cũ.
5. Tải lại trang bằng Ctrl+F5. Vào phòng học → Ngữ pháp. Ngân hàng chính hiển thị 12 đề với 642 câu chấm điểm. Bài 5–6 có 55 câu chấm, cộng 2 câu hình đang chờ xác minh trong bản đối chiếu. Menu thứ hai giữ riêng 197 câu tiến độ đã rà soát.
6. Đăng nhập tài khoản học viên, làm thử một đề rồi kiểm tra dòng “Đã lưu kết quả lên Supabase”. Bảng `ikigai_grammar_results` phải có `bank_version`, `attempt_id`, `question_ids`, `answers`, `total_count`, `correct_count`, `score_percent`. Độ dài `answers` và `question_ids` bằng `total_count`. Nếu lưu lỗi, nút “Thử lưu lại” dùng cùng mã lượt làm để tránh lưu trùng.

Nếu bản website hiện tại chưa có nút `[data-action="grammar"]`, hai liên kết CSS/JS và hàm `window.IKIGAI_GRAMMAR_CONTEXT`, cần ghép phần tích hợp từ bản 197 trước. Không dùng `app.js` cũ để đè lên bản website mới hơn chỉ vì thiếu một nút.

`IKIGAI_12_DE_DAP_AN.html` là bản đọc và kiểm tra độc lập: mở bằng trình duyệt sau khi giải nén, giữ nguyên thư mục ảnh bên cạnh. Bản này có đủ 644 câu đối chiếu, đáp án, đoạn đọc, hình và 197 câu cũ. Các tệp trong `audit` và báo cáo dùng để kiểm tra, không cần chép lên website công khai.

Mỗi câu trắc nghiệm được tính một điểm rồi quy đổi thang 100. Một câu có thể gộp nhiều ô trống, vì vậy điểm này không sao chép trọng số điểm tự luận in trong Word. Kết quả của ngân hàng nguồn và ngân hàng 197 được phân biệt bằng `bank_version`; lịch sử cũ vẫn ở cơ sở dữ liệu, nhưng không trộn vào điểm cao nhất của phiên bản mới.

Gói chưa được triển khai lên website và chưa chạy SQL trên Supabase thật. Kiểm thử lưu điểm sử dụng kết nối giả lập. Đây là chức năng luyện tập với đáp án ở phía trình duyệt; điểm chưa được máy chủ xác minh độc lập để dùng cho một kỳ thi bảo mật.

Quyền dữ liệu tiếp tục theo mô hình mỗi người dùng đăng nhập chỉ đọc/thêm kết quả của mình qua RLS. Điều kiện “học viên” còn nằm ở giao diện hiện có; gói này không tự đoán cấu trúc bảng vai trò để sửa quyền hệ thống.
