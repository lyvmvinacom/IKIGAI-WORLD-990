import {kanjiWord,kanjiMeaning} from './kanji-meanings.js?v=jft-bomb-2';
export function bombCards(test,pool,buildChoices,shuffle){
 const meanings=['máy giặt','tủ lạnh','xe buýt','cà phê','bánh mì','quả táo','sân bay','cầu thang','tầng hai','nhà bếp','con mèo','con chim','tháng trước','tháng sau','màu tím','cái ô','giày dép'];
 return test.questions.map((q,i)=>{
  const m=kanjiMeaning(q);if(!m)throw new Error('Chưa có nghĩa tiếng Việt cho '+kanjiWord(q)+'. Giáo viên hãy bổ sung nghĩa trước khi chơi.');
  return {id:q.id,n:q.n||i+1,lesson:1,k:kanjiWord(q),r:[...new Set(q.accepted.map(n=>q.options[n]))].join(' / '),m,readingOptions:buildChoices(q,pool),ms:shuffle(meanings.filter(s=>!m.toLocaleLowerCase('vi').includes(s)&&!s.includes(m.toLocaleLowerCase('vi')))).slice(0,3),ctx:test.title};
 });
}
export function mountKanjiBomb({host,test,pool,onComplete,onMenu,onClose,buildChoices,shuffle}){
 const session=crypto.randomUUID(),cards=bombCards(test,pool,buildChoices,shuffle),frame=document.createElement('iframe');let disposed=false,completed=false;
 host.classList.add('jft-game-active');host.hidden=false;host.replaceChildren(frame);
 frame.title='JFT A2 · Gỡ bom Kanji · Cách đọc và ý nghĩa';frame.allow='autoplay';frame.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;background:#101923';
 const send=type=>frame.contentWindow?.postMessage({type,session,title:test.title,cards},location.origin);
 const receive=e=>{const d=e.data;if(disposed||e.origin!==location.origin||e.source!==frame.contentWindow||d?.session!==session)return;
  if(d.type==='jft-bomb-menu')onMenu();
  if(d.type==='jft-bomb-close')onClose();
  if(d.type==='jft-bomb-complete'&&!completed){
   if(!Array.isArray(d.results)||d.results.length!==test.questions.length)return;
   const results=new Map(d.results.map(r=>[r.id,r]));if(results.size!==test.questions.length)return;
   if(test.questions.some(q=>!results.has(q.id)))return;
   completed=true;const answers=test.questions.map(q=>{const r=results.get(q.id);return r.correct===true&&q.accepted.includes(r.index)?r.index:-1;});
   const selections=test.questions.map(q=>{const r=results.get(q.id);return r.correct?'✓ '+q.options[r.index]+' · '+kanjiMeaning(q):'✕ Chưa gỡ được cả hai khóa';});
   onComplete(answers,selections);
  }
 };
 window.addEventListener('message',receive);frame.onload=()=>send('jft-bomb-init');frame.src=new URL('kanji-bomb.html?v=jft-bomb-2&jftSession='+encodeURIComponent(session),document.baseURI).href;
 return {dispose(){if(disposed)return;send('jft-bomb-stop');disposed=true;window.removeEventListener('message',receive);frame.remove();host.classList.remove('jft-game-active')}};
}
