const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
export async function validateAudioUpdate(data){
 if(data?.format!=='ikigai-jft-audio-1'||!Array.isArray(data.tests)||!data.tests.length||data.tests.length>10)throw Error('JSON âm thanh cần 1–10 đề.');
 const ids=new Set();
 for(const test of data.tests){
  if(!/^sore-vol(?:1-(?:0[1-9]|10)|2-(?:1[1-9]|20))$/.test(test.id)||ids.has(test.id)||typeof test.title!=='string'||!Array.isArray(test.questions)||test.questions.length!==12)throw Error('Mã đề không hợp lệ, bị trùng hoặc chưa đủ 12 câu nghe.');
  ids.add(test.id);const numbers=new Set();
  for(const q of test.questions){
   if(!Number.isInteger(q.number)||q.number<27||q.number>38||numbers.has(q.number)||!Array.isArray(q.turns)||q.turns.length<1||q.turns.length>20||q.turns.some(t=>!Array.isArray(t)||t.length!==2||!['Nam','Nữ'].includes(t[0])||typeof t[1]!=='string'||!t[1].trim())||typeof q.mp3!=='string'||q.mp3.length<1000||q.mp3.length>850000||q.mp3.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(q.mp3)||!/^[a-f0-9]{64}$/.test(q.sha256))throw Error(test.id+': dữ liệu câu nghe không hợp lệ.');
   numbers.add(q.number);
   const bytes=Uint8Array.from(atob(q.mp3),c=>c.charCodeAt(0));
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
   if(hash!==q.sha256)throw Error(test.id+' câu '+q.number+': âm thanh bị hỏng hoặc sai mã kiểm tra.');
  }
 }
 return data;
}
export async function previewAudioUpdate({data,main,account,status,signal}){
 if(!account.canManage||!account.importAudio)throw Error('Cần tài khoản giáo viên và bản cập nhật hỗ trợ nhập audio.');
 status.textContent='Đang kiểm tra 12 audio mỗi đề và mã kiểm tra tệp…';
 await validateAudioUpdate(data);if(signal?.aborted)return;
 const $=id=>main.querySelector('#'+id),preview=$('shared-preview');
 preview.innerHTML=`<h2>Cập nhật riêng phần nghe · ${data.tests.length} đề</h2><p>Chỉ thay MP3 của câu 27–38. Đề gốc, đáp án, tiến độ, kết quả và EXP được giữ nguyên. Nạp lại cùng tệp sẽ tiếp tục các câu còn thiếu.</p>${data.tests.map(t=>`<details><summary>${esc(t.title)} · 12 câu nghe</summary>${t.questions.map(q=>`<details><summary>Câu ${q.number} · ${Number(q.seconds||0).toFixed(1)} giây</summary><audio controls preload="none" src="data:audio/mpeg;base64,${q.mp3}"></audio>${q.turns.map(([r,t])=>`<p>${esc(r)}: <span lang="ja">${esc(t)}</span></p>`).join('')}</details>`).join('')}</details>`).join('')}<p><label><input type="checkbox" id="audio-reviewed"> Tôi đã kiểm tra và muốn thay âm thanh cho các đề trên.</label></p><button class="btn" id="audio-publish" disabled>Cập nhật âm thanh</button>`;
 preview.hidden=false;status.textContent='Đã kiểm tra tệp. Có thể nghe thử từng câu trước khi cập nhật.';
 $('audio-reviewed').onchange=()=>{$('audio-publish').disabled=!$('audio-reviewed').checked;};
 $('audio-publish').onclick=async()=>{
  const controls=['audio-publish','import-preview','shared-file','import-back'];controls.forEach(id=>$(id).disabled=true);
  try{
   const result=await account.importAudio(data,signal,({completed,total,title})=>{status.textContent=`Đã cập nhật ${completed}/${total} câu · ${title}`;});
   if(signal?.aborted)return;
   status.textContent=`Hoàn tất ${result.length} câu nghe. Mở lại đề để dùng audio mới.`;
   $('audio-reviewed').disabled=true;
  }catch(e){if(!signal?.aborted){status.textContent=e.message||'Chưa cập nhật được. Có thể nạp lại cùng tệp.';$('audio-publish').disabled=false;}}
  finally{['import-preview','shared-file','import-back'].forEach(id=>$(id).disabled=false);}
 };
}
