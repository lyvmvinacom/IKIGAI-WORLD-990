// Vietnamese meanings for the JFT Kanji bank, keyed by the displayed Japanese word.
export const kanjiWord=q=>String(q.prompt||'').replace(/^Chọn cách đọc đúng(?: cho (?:từ sau|chữ|mẫu|động từ|danh từ|tính từ|cụm|từ)| của)\s*:?\s*/u,'').replace(/[.。]\s*$/u,'').trim();
export const KANJI_MEANINGS=Object.fromEntries(`
去年|năm ngoái
学生|học sinh, sinh viên
学校|trường học
生活|cuộc sống, sinh hoạt
仕事|công việc
元気|khỏe mạnh, khỏe khoắn
忙しい|bận rộn
働く|làm việc
作る|làm, tạo ra
英語|tiếng Anh
二人|hai người
犬|con chó
夕方|chiều tối
音楽|âm nhạc
払う|trả tiền, thanh toán
話す|nói, trò chuyện
家族|gia đình
出かける|đi ra ngoài
季節|mùa trong năm
春|mùa xuân
夏|mùa hè
秋|mùa thu
冬|mùa đông
花|hoa
同じ|giống nhau
暑い|nóng (thời tiết)
寒い|lạnh (thời tiết)
昨日|hôm qua
明日|ngày mai
毎日|mỗi ngày
今|bây giờ
強い|mạnh
天気|thời tiết
晴れ|trời nắng, quang đãng
雨|mưa
雪|tuyết
風|gió
町|thị trấn, khu phố
店|cửa hàng
食堂|nhà ăn, quán ăn
便利|tiện lợi
不便|bất tiện
静か|yên tĩnh
有名|nổi tiếng
多い|nhiều
少ない|ít
遠い|xa
社員|nhân viên công ty
道|con đường
公園|công viên
お寺|chùa
みず|nước
近く|gần, khu vực lân cận
送る|gửi, đưa tiễn
銀行|ngân hàng
時間|thời gian, giờ
電車|tàu điện
場所|địa điểm
駅|nhà ga
止まる|dừng lại
着く|đến nơi
急ぐ|vội, khẩn trương
受付|quầy tiếp nhận, lễ tân
円|yên (đơn vị tiền Nhật)
博物館|bảo tàng
動物園|vườn thú
試合|trận đấu
食事|bữa ăn, việc ăn uống
お金|tiền
楽しい|vui vẻ, thú vị
〜店|cửa hàng… (hậu tố)
難しい|khó
登る|leo, trèo
練習|luyện tập
漢字|chữ Hán, Kanji
大学|đại học
高校|trường trung học phổ thông
説明する|giải thích
無料|miễn phí
言う|nói
書く|viết
貸す|cho mượn, cho thuê
教える|dạy, chỉ cho biết
午前|buổi sáng, trước 12 giờ trưa
午後|buổi chiều, sau 12 giờ trưa
先生|thầy, cô giáo
教科書|sách giáo khoa
教室|phòng học
全部|toàn bộ, tất cả
〜回|… lần (đếm số lần)
参加する|tham gia
用意する|chuẩn bị
飲み物|đồ uống
牛肉|thịt bò
豚肉|thịt lợn
持って行く|mang đi
お茶|trà
お酒|rượu, đồ uống có cồn
材料|nguyên liệu, vật liệu
野菜|rau
皿|đĩa
売る|bán
料理|món ăn, việc nấu ăn
調理方法|phương pháp nấu ăn
少し|một chút
卵|trứng
お湯|nước nóng
味|vị, hương vị
甘い|ngọt
辛い|cay
苦手（な）|kém, không giỏi
電気|điện
音|âm thanh
動く|chuyển động, hoạt động
都合|sự thuận tiện, hoàn cảnh sắp xếp
数字|chữ số
コピー機|máy photocopy
机|bàn học, bàn làm việc
悪い|xấu, không tốt
使う|sử dụng
終わる|kết thúc
お願いします|xin vui lòng, nhờ anh/chị giúp
用事|việc cần làm, việc bận
連絡先|thông tin liên lạc
氏名|họ và tên
理由|lý do
別|khác, riêng biệt
早く|sớm, nhanh lên
吸う|hít, hút
取る|lấy, cầm lấy
帰る|về
伝える|truyền đạt, báo lại
病気|bệnh, ốm
住所|địa chỉ
熱|sốt, nhiệt
薬|thuốc
病院|bệnh viện
医者|bác sĩ
〜才|… tuổi
痛い|đau
眠い|buồn ngủ
寝る|ngủ, đi ngủ
退院する|xuất viện
体|cơ thể
顔|khuôn mặt
目|mắt
耳|tai
頭|đầu
足|chân
手|tay
口|miệng
起きる|thức dậy
歩く|đi bộ
走る|chạy
運動する|vận động, tập thể dục
男|nam giới, đàn ông
お兄さん|anh trai (cách gọi lịch sự)
姉|chị gái (của mình)
お姉さん|chị gái (cách gọi lịch sự)
弟|em trai
妹|em gái
夫|chồng
妻|vợ
両親|bố mẹ
お父さん|bố (cách gọi lịch sự)
お母さん|mẹ (cách gọi lịch sự)
男の子|bé trai
女の子|bé gái
お祝い|lời chúc mừng, quà mừng
誕生日|sinh nhật
結婚|kết hôn
時計|đồng hồ
幸せ（な）|hạnh phúc
思う|nghĩ, cảm thấy
選ぶ|lựa chọn
合格する|thi đỗ
生まれる|được sinh ra
意味|ý nghĩa
海|biển
島|đảo
森|rừng
客様|quý khách (cách gọi kính trọng)
経験|kinh nghiệm
上手|giỏi, khéo
明るい|sáng, vui vẻ
歌手|ca sĩ
写真|ảnh, bức ảnh
長い|dài
短い|ngắn
会計|thanh toán, tính tiền
電話番号|số điện thoại
牛乳|sữa bò
自由|tự do
注文|gọi món, đặt hàng
予約|đặt trước
人数|số người
禁煙|cấm hút thuốc
満足|hài lòng, thỏa mãn
塩|muối
油|dầu
用意|sự chuẩn bị
一緒に|cùng nhau
焼く|nướng, rán
出発する|xuất phát, khởi hành
計画|kế hoạch
旅館|nhà trọ kiểu Nhật
自然|thiên nhiên, tự nhiên
自転車|xe đạp
交通|giao thông
船|tàu, thuyền
週末|cuối tuần
到着する|đến nơi, tới nơi
運転|lái xe, vận hành
事故|tai nạn
故障|hỏng hóc, sự cố máy móc
指定席|ghế chỉ định, ghế đặt trước
空|bầu trời
泳ぐ|bơi
お知らせ|thông báo
工事|công trình, việc thi công
条件|điều kiện
以上|từ mức đó trở lên
水道|nước máy, hệ thống cấp nước
広場|quảng trường
申し|phần đầu của 申す (thưa, nói khiêm nhường)
今月|tháng này
禁止|cấm
会場|địa điểm tổ chức
体験|trải nghiệm
世界|thế giới
始まる|bắt đầu
申し込む|đăng ký
特別|đặc biệt
文化|văn hóa
今年|năm nay
昨年|năm ngoái (cách nói trang trọng)
正月|Tết năm mới
週間|khoảng thời gian tính bằng tuần
全員|tất cả mọi người
入院する|nhập viện
自分|bản thân
普通|bình thường, thông thường
袋|túi
暗い|tối
怒る|tức giận
色|màu sắc
青|màu xanh lam
女性|nữ giới
男性|nam giới
案内する|hướng dẫn
急に|đột nhiên
商品|hàng hóa, sản phẩm
値段|giá tiền
価格|giá cả
消費税|thuế tiêu dùng
重い|nặng
軽い|nhẹ
店員|nhân viên cửa hàng
道具|dụng cụ
図書館|thư viện
借ります|mượn, thuê
返す|trả lại
利用する|sử dụng dịch vụ, tận dụng
料金|phí, cước phí
情報|thông tin
相談|trao đổi, bàn bạc để xin ý kiến
質問|câu hỏi, việc hỏi
外国|nước ngoài
郵便局|bưu điện
危険|nguy hiểm
種類|loại, chủng loại
捨てる|vứt bỏ
大切|quan trọng, quý giá
台風|bão
地震|động đất
卒業する|tốt nghiệp
山|núi
川|sông
着る|mặc (áo)
歌|bài hát
立つ|đứng
泣く|khóc
生|sống, chưa nấu chín (đọc なま)
ご飯|cơm, bữa ăn
分ける|chia, phân chia
入れる|cho vào
～方|phía, hướng (đọc ～ほう)
遊ぶ|chơi
調べる|tra cứu, tìm hiểu
光る|phát sáng, tỏa sáng
絵|tranh, bức vẽ
開く|mở
生産する|sản xuất
場合|trường hợp
国際交流|giao lưu quốc tế
紙|giấy
来年|năm sau
大人|người lớn
毎年|hằng năm
祭り|lễ hội
～式|lễ…, nghi thức…
米|gạo
店長|cửa hàng trưởng
服|quần áo
赤|màu đỏ
黒|màu đen
白|màu trắng
営業する|kinh doanh, mở cửa hoạt động
税別|chưa bao gồm thuế
変わる|thay đổi
親切（な）|tốt bụng, nhiệt tình
市|thành phố (đọc し)
～点|… điểm
閉まる|đóng lại
窓口|quầy giao dịch
入力する|nhập dữ liệu
自動|tự động
近所|khu lân cận, hàng xóm
出す|lấy ra, đưa ra
設定する|cài đặt, thiết lập
消す|tắt, xóa
燃える|cháy
決める|quyết định
外|bên ngoài
危ない|nguy hiểm, không an toàn
心配（な）|lo lắng
進む|tiến lên, tiến triển
大変（な）|vất vả, khó khăn
最近|gần đây
慣れる|quen với
問題|vấn đề, câu hỏi
困る|gặp khó khăn, lúng túng
増える|tăng lên
笑う|cười
留学する|du học
住む|sống, cư trú
役に立つ|có ích
特に|đặc biệt là
募集|tuyển dụng, tuyển người
希望|nguyện vọng, hy vọng
建てる|xây dựng
続ける|tiếp tục
考える|suy nghĩ
`.trim().split('\n').map(line=>line.split('|')));
export function kanjiMeaning(q){return q.meaningVi?.trim()||KANJI_MEANINGS[kanjiWord(q)]||'';}
