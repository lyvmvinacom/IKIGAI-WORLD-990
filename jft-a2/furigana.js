// Furigana is display metadata. Source strings and scoring payloads stay untouched.
export const escapeText=(value='')=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const kana=/^[\u3041-\u3096\u30a1-\u30faー・ 　]+$/u;
const han=/[\p{Script=Han}々]/u;
export function fieldText(question,field){
 if(/^options\.[0-3]$/.test(field))return question.options?.[Number(field.split('.')[1])]??'';
 if(['prompt','passage','instruction'].includes(field))return question[field]??'';
 return '';
}
export function normalizeFields(question,fields){
 const clean={};
 if(!fields||typeof fields!=='object'||Array.isArray(fields))return clean;
 for(const [field,value] of Object.entries(fields)){
  const text=fieldText(question,field),chars=Array.from(text);let end=0;
  if(!text||value?.text!==text||!Array.isArray(value.spans)||value.spans.length>100)continue;
  const valid=value.spans.every(span=>{
   if(!Number.isInteger(span.start)||!Number.isInteger(span.end)||span.start<end||span.end<=span.start||span.end>chars.length||typeof span.reading!=='string'||!span.reading.trim()||span.reading.length>100||!kana.test(span.reading))return false;
   end=span.end;return true;
  });
  if(valid&&value.spans.length)clean[field]={text,spans:value.spans.map(({start,end,reading})=>({start,end,reading}))};
 }
 return clean;
}
export function renderFurigana(question,field,underline=null){
 const text=fieldText(question,field),chars=Array.from(text),entry=normalizeFields(question,question.furigana?.fields)[field];
 const spans=entry?.spans??[];let html='',cursor=0;
 let uStart=-1,uEnd=-1;
 if(underline&&text.includes(underline)){
  const i=text.indexOf(underline);uStart=Array.from(text.slice(0,i)).length;uEnd=uStart+Array.from(underline).length;
 }
 // Keep a ruby group together, including any underlined base text.
 // Split only the base at underline boundaries so ruby annotations cannot corrupt markup.
 const base=(start,end)=>{
  const chunk=chars.slice(start,end).join('');
  if(uStart<0||end<=uStart||start>=uEnd)return escapeText(chunk);
  const lo=Math.max(start,uStart),hi=Math.min(end,uEnd);
  return escapeText(chars.slice(start,lo).join(''))+'<u>'+escapeText(chars.slice(lo,hi).join(''))+'</u>'+escapeText(chars.slice(hi,end).join(''));
 };
 const segment=(start,end)=>base(start,end);
 for(const span of spans){html+=segment(cursor,span.start)+`<ruby>${base(span.start,span.end)}<rp>（</rp><rt>${escapeText(span.reading)}</rt><rp>）</rp></ruby>`;cursor=span.end;}
 html+=segment(cursor,chars.length);return html;
}
export function replaceReading(fields,field,text,start,end,reading){
 const next=structuredClone(fields);const spans=(next[field]?.text===text?next[field].spans:[]).filter(s=>s.end<=start||s.start>=end);
 if(reading.trim())spans.push({start,end,reading:reading.trim()});
 spans.sort((a,b)=>a.start-b.start);
 if(spans.length)next[field]={text,spans};else delete next[field];
 return next;
}
export function openFuriganaEditor({dialog,question,examId,number,account,signal,showDialog,onApplied}){
 let fields=normalizeFields(question,question.furigana?.fields),revision=question.furigana?.revision??0;
 let field='',range=null,dirty=false,saving=false,valid=true;
 const choices=[['prompt','Câu hỏi'],['passage','Bài đọc'],['instruction','Hướng dẫn'],...question.options.map((_,i)=>['options.'+i,'Đáp án '+String.fromCharCode(65+i)])].filter(([key])=>fieldText(question,key));
 const warning=question.underlined||/cách đọc|読み方|đọc.*[Hh]án/.test(question.instruction);
 showDialog('Furigana · Câu '+number,`<div class="furigana-editor">${warning?'<p class="furigana-note">Câu này có thể kiểm tra cách đọc Kanji. Hãy tránh gắn phiên âm vào chữ đang được kiểm tra.</p>':''}<div class="furigana-grid"><section><label for="furigana-field">Vị trí cần sửa</label><select id="furigana-field">${choices.map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select><label for="furigana-source">Bôi đen Kanji cần gắn cách đọc</label><textarea id="furigana-source" class="ja" readonly spellcheck="false" rows="3"></textarea><div class="furigana-reading-row"><label for="furigana-reading"><span id="furigana-selected">Chưa chọn chữ</span><input id="furigana-reading" lang="ja" autocomplete="off" placeholder="Nhập hiragana / katakana" disabled></label><button type="button" class="ghost" id="furigana-delete" disabled>Xóa furigana</button></div><div id="furigana-existing" class="furigana-existing"></div></section><section><h3>Xem trước</h3><div id="furigana-preview" class="furigana-preview ja" lang="ja"></div><p id="furigana-status" role="status" aria-live="polite">Chỉ vị trí được chọn sẽ thay đổi.</p></section></div></div>`,`<button class="ghost" id="furigana-cancel">Hủy</button><button class="btn" id="furigana-apply" disabled>Áp dụng</button>`,true);
 dialog.classList.add('furigana-dialog');
 const $=id=>dialog.querySelector('#'+id),source=$('furigana-source'),reading=$('furigana-reading'),apply=$('furigana-apply');
 const setStatus=message=>{$('furigana-status').textContent=message;};
 const refresh=()=>{
  $('furigana-preview').innerHTML=renderFurigana({...question,furigana:{fields}},field,field==='prompt'?question.underlined:null);
  const spans=fields[field]?.spans??[];
  $('furigana-existing').innerHTML=spans.map((span,i)=>`<button class="ghost" type="button" data-furigana-span="${i}">${escapeText(Array.from(source.value).slice(span.start,span.end).join(''))} · ${escapeText(span.reading)}</button>`).join('');
  $('furigana-existing').querySelectorAll('button').forEach(button=>{button.onclick=()=>{
   const s=spans[Number(button.dataset.furiganaSpan)];selectRange(s.start,s.end);reading.focus();
  };});
  apply.disabled=!dirty||!valid||saving;
 };
 const selectRange=(start,end)=>{
  range={start,end};const word=Array.from(source.value).slice(start,end).join('');
  $('furigana-selected').textContent=word;reading.disabled=false;
  reading.value=(fields[field]?.spans??[]).find(s=>s.start===start&&s.end===end)?.reading??'';
  $('furigana-delete').disabled=!(fields[field]?.spans??[]).some(s=>s.start<end&&s.end>start);
  valid=true;refresh();
 };
 const changeField=()=>{
  field=$('furigana-field').value;source.value=fieldText(question,field);range=null;
  reading.value='';reading.disabled=true;$('furigana-delete').disabled=true;$('furigana-selected').textContent='Chưa chọn chữ';valid=true;refresh();
 };
 source.addEventListener('select',()=>{
  if(saving||source.selectionStart===source.selectionEnd)return;
  const word=source.value.slice(source.selectionStart,source.selectionEnd);
  if(!han.test(word)){setStatus('Hãy chọn một từ có Kanji.');return;}
  selectRange(Array.from(source.value.slice(0,source.selectionStart)).length,Array.from(source.value.slice(0,source.selectionEnd)).length);
 });
 reading.oninput=()=>{
  if(!range||saving)return;
  const value=reading.value.trim();valid=!value||(value.length<=100&&kana.test(value));
  if(!valid){setStatus('Cách đọc cần là hiragana hoặc katakana.');refresh();return;}
  fields=replaceReading(fields,field,source.value,range.start,range.end,value);dirty=true;
  $('furigana-delete').disabled=!value;setStatus('Đang xem trước. Bấm Áp dụng để lưu.');refresh();
 };
 $('furigana-delete').onclick=()=>{
  if(!range||saving)return;
  fields=replaceReading(fields,field,source.value,range.start,range.end,'');reading.value='';dirty=true;valid=true;
  $('furigana-delete').disabled=true;setStatus('Đã xóa trong bản xem trước. Bấm Áp dụng để lưu.');refresh();
 };
 $('furigana-field').onchange=changeField;
 $('furigana-cancel').onclick=()=>{if(!saving)dialog.close();};
 const onCancel=event=>{if(saving)event.preventDefault();};
 dialog.addEventListener('cancel',onCancel);
 dialog.addEventListener('close',()=>{dialog.classList.remove('furigana-dialog');dialog.removeEventListener('cancel',onCancel);},{once:true});
 apply.onclick=async()=>{
  if(!dirty||!valid||saving||!account.canManage)return;
  saving=true;dialog.querySelectorAll('input,select,button,textarea').forEach(el=>el.disabled=true);setStatus('Đang lưu furigana…');
  try{
   const result=await account.saveFurigana(examId,number,fields,revision,signal);
   if(signal?.aborted)return;
   question.furigana={fields:normalizeFields(question,result.fields),revision:result.revision};
   dialog.close();onApplied();
  }catch(error){if(!signal?.aborted){setStatus(error.message||'Chưa lưu được. Hãy thử lại.');}}
  finally{
   saving=false;
   if(dialog.open&&!signal?.aborted){dialog.querySelectorAll('select,button,textarea').forEach(el=>el.disabled=false);reading.disabled=!range;$('furigana-delete').disabled=!range||!reading.value;refresh();}
  }
 };
 changeField();
}
