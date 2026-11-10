export const demo = {
  id: 'ikigai-demo',
  title: 'Bài mẫu IKIGAI',
  minutes: 12,
  source: 'IKIGAI EDUCATION · Bài luyện tự soạn',
  questions: [
    {section:0,instruction:'Chọn cách đọc đúng của từ trong ngoặc.',prompt:'あした、【受付】で カードを もらいます。',options:['うけつけ','うけとり','うけもち'],correct:0,explanation:'受付（うけつけ）là quầy tiếp tân hoặc nơi tiếp nhận.'},
    {section:0,instruction:'Chọn từ phù hợp với tình huống.',prompt:'電車に 乗る前に、駅で ＿＿ を 買います。',options:['かさ','きっぷ','てがみ'],correct:1,explanation:'きっぷ là vé tàu. 駅で切符を買う nghĩa là mua vé ở ga.'},
    {section:1,instruction:'Chọn cách đáp lịch sự trong hội thoại.',prompt:'A：このいす、使っても いいですか。\nB：ええ、＿＿。',options:['それは 大変ですね','あとで 来ました','どうぞ'],correct:2,explanation:'どうぞ là cách mời tự nhiên khi đồng ý cho người kia dùng ghế.'},
    {section:1,instruction:'Chọn câu phù hợp khi đến muộn.',prompt:'先生：田村さん、おはようございます。\n田村：おはようございます。＿＿。',options:['遅れて すみません','先に 帰ります','おかげさまで'],correct:0,explanation:'遅れてすみません là lời xin lỗi vì đến muộn.'},
    {section:2,instruction:'Nghe hội thoại và chọn một đáp án.',prompt:'',options:['午前十時','午後二時','午後四時'],correct:1,explanation:'Người nữ chọn 2 giờ chiều vì buổi sáng phải làm việc.',listen:{file:'audio/ikigai-demo-05.mp3',questionVi:'Hai người sẽ gặp nhau lúc mấy giờ?',question:'二人は 何時に 会いますか。',turns:[['Nam','土曜日、何時に 会いましょうか。午前十時は どうですか。'],['Nữ','午前は 仕事です。午後二時なら 大丈夫です。'],['Nam','じゃあ、午後二時に 駅で 会いましょう。']]}},
    {section:2,instruction:'Nghe thông báo và chọn một đáp án.',prompt:'',options:['図書館の 入口','二階の 教室','一階の 会議室'],correct:2,explanation:'Thông báo đổi địa điểm sang phòng họp ở tầng 1.',listen:{file:'audio/ikigai-demo-06.mp3',questionVi:'Buổi giới thiệu hôm nay diễn ra ở đâu?',question:'今日の 説明会は どこで ありますか。',turns:[['Nữ','今日の 説明会は、二階の 教室では ありません。一階の 会議室へ 来てください。時間は 予定どおりです。']]}},
    {section:3,instruction:'Đọc thông báo và chọn đáp án đúng.',passage:'市民プールのお知らせ\n水曜日の午前中は 掃除のため、プールを 使えません。午後一時から 使えます。',prompt:'水曜日は 何時から プールを 使えますか。',options:['午後一時から','午前十時から','朝から'],correct:0,explanation:'午後一時から使えます nghĩa là có thể sử dụng từ 1 giờ chiều.'},
    {section:3,instruction:'Đọc tin nhắn và chọn đáp án đúng.',passage:'山口さんへ\n日曜日の料理教室は 十時に 始まります。エプロンを 持って 来てください。材料は 教室で 用意します。\n小林',prompt:'山口さんは 何を 持って 行きますか。',options:['野菜','エプロン','料理の 本'],correct:1,explanation:'Giáo viên chuẩn bị nguyên liệu. Người học cần mang tạp dề.'}
  ]
};
