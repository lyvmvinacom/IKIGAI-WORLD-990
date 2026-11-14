import { previewAudioUpdate } from './audio-import.js?v=20261114-1';
const esc = (s='') => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
export function mountImporter({main,account,validate,existing,onBack,onImported,signal}) {
  let pending=null;
  main.innerHTML=`<div class="exam-top"><button class="ghost" id="import-back">← Danh sách đề</button></div><div class="exam-head"><h1>Nạp đề JFT dùng chung</h1><p>Chỉ giáo viên được nạp. Sau khi lưu, học viên đăng nhập sẽ thấy đề trên mọi thiết bị.</p></div>
  <section class="panel manage-panel"><h2>1. Chọn bộ đề</h2><p>Tệp JSON IKIGAI JFT hoặc JSON cập nhật riêng âm thanh, tối đa 10 đề / 32 MB mỗi lần. Mỗi đề: 50 câu, đủ 4 phần và 12 câu nghe có câu hỏi tiếng Việt, hội thoại, MP3.</p><p>PDF hoặc Word cần chuyển thành tệp dữ liệu trước khi nạp để có câu hỏi tương tác, đáp án và âm thanh.</p>
  <button class="ghost" id="import-template">Tải mẫu dữ liệu JSON</button><p><label for="shared-file">Tệp bộ đề (.json)</label></p><input id="shared-file" type="file" accept=".json,application/json"><p><button class="btn" id="import-preview">Kiểm tra và xem trước</button></p>
  <p id="shared-status" role="status" aria-live="polite">Chưa chọn bộ đề.</p></section><section id="shared-preview" class="panel manage-panel" hidden></section>`;
  const $=id=>main.querySelector('#'+id),status=$('shared-status');
  $('import-back').onclick=onBack;
  $('import-template').onclick=()=>{
    const questions=Array.from({length:50},(_,i)=>{const section=i<14?0:i<26?1:i<38?2:3;
      return {section,instruction:'',prompt:'',options:['','','',''],correct:null,explanation:'',...(section===2?{listen:{question:'',questionVi:'',turns:[['Nam',''],['Nữ','']],mp3:''}}:{})};});
    const blob=new Blob([JSON.stringify({format:'ikigai-jft-1',source:'IKIGAI EDUCATION',tests:[{id:'ikigai-jft-11',title:'Đề 11',minutes:60,questions}]},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='IKIGAI_JFT_MAU_NAP_DE.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status.textContent='Mẫu để điền dữ liệu: cần bổ sung nội dung, đáp án đúng (0=A, 1=B, 2=C, 3=D), giải thích và MP3 dạng base64 trước khi nạp.';
  };
  $('shared-file').onchange=()=>{pending=null;$('shared-preview').replaceChildren();$('shared-preview').hidden=true;status.textContent='Bấm Kiểm tra và xem trước để đọc tệp mới.';};
  $('import-preview').onclick=async()=>{
    pending=null;const preview=$('shared-preview');preview.hidden=true;preview.replaceChildren();
    const file=$('shared-file').files[0];
    if(!file){status.textContent='Hãy chọn tệp JSON trước.';return;}
    if(file.size>32*1024*1024){status.textContent='Tệp vượt giới hạn 32 MB.';return;}
    try{
      const data=JSON.parse(await file.text());
      if(data?.format==='ikigai-jft-audio-1'){await previewAudioUpdate({data,main,account,status,signal});return;}
      const tests=validate(data);
      if(tests.length>10)throw Error('Mỗi lần nạp tối đa 10 đề.');
      for(const test of tests){
        // The server accepts an identical retry and rejects conflicting content.
        const listens=test.questions.filter(q=>q.section===2);
        if(test.questions.length!==50||new Set(test.questions.map(q=>q.section)).size!==4||listens.length!==12||listens.some(q=>!q.listen.questionVi||!q.listen.mp3))throw Error(test.title+': cần 50 câu, 4 phần và 12 câu nghe có tiếng Việt, MP3.');
      }
      // Publish only the normalized fields that the exam player supports.
      pending=JSON.stringify({format:'ikigai-jft-1',source:data.source,tests:tests.map(({source,...test})=>test)});
      preview.innerHTML=`<h2>2. Xem trước ${tests.length} đề · ${tests.length*50} câu</h2><p>Kiểm tra đáp án và nghe thử âm thanh trước khi lưu. Đề đã lưu đúng nội dung sẽ được giữ nguyên; mã trùng có nội dung khác sẽ bị từ chối.</p>${tests.map(t=>`<details><summary><strong>${esc(t.title)}</strong> · ${esc(t.id)} · ${t.minutes} phút</summary>${t.questions.map((q,i)=>`<details><summary>Câu ${i+1} · Phần ${q.section+1} · Đáp án ${'ABCD'[q.correct]}</summary><p>${esc(q.instruction)}</p><p>${esc(q.listen?.questionVi||q.prompt)}</p>${q.passage?`<pre style="white-space:pre-wrap">${esc(q.passage)}</pre>`:''}${q.figure?`<img style="max-width:100%" src="${q.figure}" alt="Hình câu hỏi">`:''}<ol type="A">${q.options.map((o,n)=>`<li>${esc(o)}${n===q.correct?' ✓':''}</li>`).join('')}</ol><p>${esc(q.explanation)}</p>${q.listen?`<audio controls preload="none" src="data:audio/mpeg;base64,${q.listen.mp3}" aria-label="Nghe thử câu ${i+1}"></audio><p>${q.listen.turns.map(([voice,text])=>esc(voice+': '+text)).join('<br>')}</p>`:''}</details>`).join('')}</details>`).join('')}<p><label><input type="checkbox" id="shared-rights"> Tôi có quyền sử dụng bộ đề này và đã kiểm tra nội dung, đáp án, âm thanh.</label></p><button class="btn" id="shared-publish" disabled>3. Lưu ${tests.length} đề cho học viên</button>`;
      preview.hidden=false;status.textContent='Dữ liệu hợp lệ. Xem trước rồi xác nhận lưu để học viên thấy đề.';
      $('shared-rights').onchange=()=>{$('shared-publish').disabled=!$('shared-rights').checked;};
      $('shared-publish').onclick=async()=>{
        const button=$('shared-publish');button.disabled=true;$('import-preview').disabled=true;$('shared-file').disabled=true;$('import-back').disabled=true;
        status.textContent='Đang lưu lần lượt từng đề…';
        try {const added=await account.importExams(pending,signal,({completed,total,title})=>{status.textContent=`Đã lưu ${completed}/${total} đề${completed<total?' · Đang xử lý '+title:' · Hoàn tất'}.`;});if(signal.aborted)return;await onImported(added);}
        catch(e){if(!signal.aborted){status.textContent=e.message||'Chưa lưu được. Hãy thử lại.';button.disabled=false;$('import-preview').disabled=false;$('shared-file').disabled=false;$('import-back').disabled=false;}}
      };
    }catch(e){status.textContent=e.message||'Tệp chưa đúng định dạng.';}
  };
}
