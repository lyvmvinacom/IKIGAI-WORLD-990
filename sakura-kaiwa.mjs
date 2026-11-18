// Sakura pilot: browser speech, no paid API or automatic pronunciation scoring.
const rows=[
[1,'おなまえは なんですか','Em tên gì?','…です'],
[1,'おくには どこですか','Em đến từ nước nào?','…です'],
[1,'なんさいですか','Em bao nhiêu tuổi?','…さいです'],
[1,'がくせいですか','Em là học sinh phải không?','はい／いいえ'],
[1,'にほんごの せんせいは だれですか','Giáo viên tiếng Nhật là ai?','…せんせいです'],
[2,'それは なんですか','Đó là cái gì?','…です'],
[2,'それは だれのですか','Đó là của ai?','…のです'],
[2,'それは なんの ほんですか','Đó là sách gì?','…の ほんです'],
[3,'おうちは どこですか','Nhà em ở đâu?','…です'],
[3,'センターは どこですか','Trung tâm ở đâu?','…です'],
[3,'きょうしつは なんがいですか','Lớp học ở tầng mấy?','…かいです'],
[4,'いま なんじですか','Bây giờ mấy giờ?','…じです'],
[4,'きょうは なんようびですか','Hôm nay thứ mấy?','…ようびです'],
[4,'まいあさ なんじに おきますか','Mỗi sáng em dậy mấy giờ?','…じに おきます'],
[5,'なんじに センターへ いきますか','Em đến trung tâm lúc mấy giờ?','…じに いきます'],
[5,'なにで センターへ いきますか','Em đến trung tâm bằng gì?','…で いきます／あるいて'],
[5,'だれと センターへ いきますか','Em đến trung tâm cùng ai?','…と いきます'],
[4,'べんきょうは なんじからですか','Em học từ mấy giờ?','…じからです'],
[4,'なんじまでですか','Đến mấy giờ?','…じまでです'],
[4,'ひるやすみは なんじからですか','Nghỉ trưa từ mấy giờ?','…じからです'],
[4,'なんじまでですか','Nghỉ trưa đến mấy giờ?','…じまでです'],
[5,'なんじに うちへ かえりますか','Em về nhà lúc mấy giờ?','…じに かえります'],
[4,'まいばん なんじに ねますか','Mỗi tối em ngủ mấy giờ?','…じに ねます'],
[4,'きのう なんじに ねましたか','Hôm qua em ngủ mấy giờ?','…じに ねました'],
[4,'きのう べんきょうしましたか','Hôm qua em có học không?','はい／いいえ'],
[4,'なんじから べんきょうしましたか','Em đã học từ mấy giờ?','…じから'],
[4,'やすみは なんようびですか','Em nghỉ thứ mấy?','…ようびです'],
[5,'にちようび どこへ いきますか','Chủ nhật em đi đâu?','…へ いきます／どこも'],
[5,'きのう どこへ いきましたか','Hôm qua em đi đâu?','…へ いきました／どこも'],
[5,'あした どこへ いきますか','Ngày mai em đi đâu?','…へ いきます／どこも'],
[5,'たんじょうびは いつですか','Sinh nhật em khi nào?','…がつ …にちです'],
[5,'きょうは なんがつ なんにちですか','Hôm nay ngày tháng mấy?','…がつ …にちです'],
[5,'いつ にほんへ いきますか','Khi nào em đi Nhật?','…に いきます'],
[5,'だれと にほんへ いきますか','Em đi Nhật cùng ai?','…と いきます'],
[5,'なにで にほんへ いきますか','Em đi Nhật bằng gì?','…で いきます'],
[3,'くつは いくらですか','Giày giá bao nhiêu?','…です'],
[3,'かばんは どこのですか','Cặp của nước nào?','…のです'],
[4,'センターは なんじからですか','Trung tâm mở từ mấy giờ?','…じからです'],
[4,'センターは なんじまでですか','Trung tâm đến mấy giờ?','…じまでです'],
[4,'あした なんじに おきますか','Ngày mai em dậy mấy giờ?','…じに おきます'],
[6,'センターで なにを しますか','Em làm gì ở trung tâm?','…を します'],
[6,'あさごはんを たべますか','Em ăn sáng không?','はい／いいえ'],
[6,'なにを たべますか','Em ăn gì?','…を たべます'],
[6,'なにを のみますか','Em uống gì?','…を のみます'],
[7,'なにで ごはんを たべますか','Em ăn cơm bằng gì?','…で たべます'],
[8,'にほんごは どうですか','Tiếng Nhật thế nào?','…です'],
[8,'センターは どんな ところですか','Trung tâm là nơi thế nào?','…ところです'],
[9,'どんな おんがくが すきですか','Em thích nhạc gì?','…が すきです'],
[9,'にほんごが わかりますか','Em hiểu tiếng Nhật không?','はい／いいえ'],
[10,'きょうしつに なにが ありますか','Trong lớp có gì?','…が あります'],
[10,'きょうしつに だれが いますか','Trong lớp có ai?','…が います']
];
export function mountSakura(host,back){
 let list=[],i=0,repeats=0,recognition=null,alive=true, speaking=false,token=0,answered=0,listenTimer=0,finishTimer=0;
 const synth=window.speechSynthesis, SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 host.hidden=false;
 host.innerHTML='<button class="close-activity" type="button">×</button><h2>🌸 さくら先生</h2><small>Thử nghiệm giọng nói · Không chấm phát âm tự động</small><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0"><select data-level><option value="5">Minna 1–5</option><option value="10">Minna 1–10</option></select><label>Tốc độ <select data-rate><option value=".7">0,7×</option><option value=".5">0,5×</option><option value=".9">0,9×</option></select></label><button class="gold" data-start>Bắt đầu</button></div><div data-count></div><div class="question" data-question lang="ja"></div><div data-help></div><div data-status role="status"></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button data-mic>🎙 Trả lời</button><button data-repeat>Nghe lại</button><button data-hint>Gợi ý</button><button data-next>Tiếp tục</button></div><input data-answer placeholder="Hoặc nhập câu trả lời tiếng Nhật" lang="ja" style="width:100%;margin:8px 0"><button data-send style="display:inline-block;margin:4px 0">Gửi câu trả lời</button><p data-result></p>';
 const $=s=>host.querySelector(s), q=()=>list[i], status=t=>$('[data-status]').textContent=t;
 function stop(){token++;clearTimeout(listenTimer);clearTimeout(finishTimer);const mic=$('[data-mic]');if(mic)mic.textContent='🎙 Trả lời';speaking=false;try{recognition?.abort()}catch{}recognition=null;synth?.cancel()}
 function close(){if(!alive)return;alive=false;stop();observer.disconnect();window.IKIGAI_AUDIO?.resume();back()}
 const observer=new MutationObserver(()=>{if(host.hidden||!host.querySelector('[data-start]')){alive=false;stop();observer.disconnect();window.IKIGAI_AUDIO?.resume()}});
 observer.observe(host,{attributes:true,attributeFilter:['hidden'],childList:true});
 function speak(t,lang='ja-JP'){stop();if(!synth||!window.SpeechSynthesisUtterance){status('Thiết bị không hỗ trợ đọc giọng nói.');return}const id=token,u=new SpeechSynthesisUtterance(t);u.lang=lang;u.rate=Number($('[data-rate]').value);const v=synth.getVoices().find(v=>v.lang===lang);if(v)u.voice=v;speaking=true;u.onend=u.onerror=()=>{if(id===token)speaking=false};synth.speak(u)}
 function show(){stop();repeats=0;$('[data-help]').textContent='';$('[data-answer]').value='';$('[data-result]').textContent='';if(!q()){$('[data-question]').textContent='おつかれさまでした。';$('[data-count]').textContent='Đã trả lời '+answered+'/'+list.length+' câu (không phải điểm đúng).';status('Kết thúc');return}$('[data-count]').textContent='Câu '+(i+1)+'/'+list.length;$('[data-question]').textContent=q()[1]+'？';status('');speak(q()[1]+'？')}
 function repeat(){if(!q())return;if(repeats<3){repeats++;speak(q()[1]+'？')}else{$('[data-help]').textContent=q()[2];speak(q()[2],'vi-VN')}}
 function next(){if(!q())return;i++;show()}
 function submit(){if(!q())return;const a=$('[data-answer]').value.trim();if(!a)return;if(/わかりません|分かりません|もう一度|もういちど/.test(a)){repeat();return}const fixes=[[/バイクを(?=行|いき)/,'バイクで'],[/自転車を(?=行|いき)/,'自転車で'],[/バスに(?=行|いき)/,'バスで']];for(const [p,b] of fixes){if(p.test(a)){const fixed=a.replace(p,b);$('[data-result]').textContent=fixed;speak(fixed);return}}answered++;next()}
 $('[data-start]').onclick=()=>{window.IKIGAI_AUDIO?.suspend();const level=Number($('[data-level]').value);list=rows.filter(r=>r[0]<=level);if(level===10)list=list.slice(0,17).concat(list.slice(40),list.slice(17,29));i=0;answered=0;show()};
 $('[data-repeat]').onclick=repeat;$('[data-hint]').onclick=()=>{if(q())$('[data-help]').textContent=q()[3]};$('[data-next]').onclick=next;$('[data-send]').onclick=submit;$('[data-mic]').onclick=()=>{
 if(!q())return;
 if(recognition){recognition.ikigaiFinish?.();return}
 if(!SR){status('Trình duyệt không hỗ trợ nhận diện. Hãy nhập câu trả lời.');return}
 if(speaking){status('Chờ cô nói xong hoặc bấm Nghe lại.');return}
 stop();const id=token;let rec,heard='',done=false;
 const active=()=>alive&&id===token&&!done;
 function settle(message,accept=false){
  if(!active())return;done=true;clearTimeout(listenTimer);clearTimeout(finishTimer);recognition=null;
  $('[data-mic]').textContent='🎙 Trả lời';
  try{rec?.abort()}catch{}
  if(accept&&heard.trim()){ $('[data-answer]').value=heard.trim();status('Đã nhận: '+heard.trim());submit(); }
  else status(message);
 }
 function finish(){
  if(!active())return;clearTimeout(listenTimer);status('Đang xử lý…');
  try{rec.stop()}catch{settle('Không nhận được câu trả lời. Hãy thử lại.',true);return}
  if(active())finishTimer=setTimeout(()=>settle('Không nhận được câu trả lời. Hãy thử lại hoặc nhập chữ.',true),3000);
 }
 try{
  rec=new SR();recognition=rec;rec.ikigaiFinish=finish;rec.lang='ja-JP';rec.continuous=false;rec.interimResults=true;rec.maxAlternatives=1;
  rec.onstart=()=>{if(active())status('Đang nghe… Nói xong có thể bấm Dừng.')};
  rec.onresult=e=>{if(!active())return;heard=Array.from(e.results).map(x=>x[0].transcript).join(' ');$('[data-answer]').value=heard;if(Array.from(e.results).every(x=>x.isFinal))settle('',true)};
  rec.onspeechend=()=>{if(active())finish()};
  rec.onend=()=>settle('Chưa nghe rõ. Bấm micro để thử lại.',true);
  rec.onerror=e=>settle(e.error==='not-allowed'||e.error==='service-not-allowed'?'Hãy cấp quyền micro và nhận diện giọng nói trong cài đặt trình duyệt.':e.error==='network'?'Lỗi mạng nhận diện giọng nói. Thử lại hoặc nhập chữ.':'Chưa nhận diện được. Hãy thử lại.',true);
  $('[data-answer]').value='';$('[data-mic]').textContent='⏹ Dừng';status('Đang mở micro…');
  rec.start();if(active())listenTimer=setTimeout(finish,20000);
 }catch{settle('Không mở được micro. Hãy kiểm tra quyền hoặc nhập chữ.')}
};
host.querySelector('.close-activity').onclick=close;
}
