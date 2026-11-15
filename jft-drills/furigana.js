const kanji=/[\p{Script=Han}々〆]/u;
const annotatable=/[\p{Script=Han}々〆0-9０-９]/u;
const kana=s=>String(s??'').normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)).replace(/\s/g,'');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Source prompts contain the approved reading after sourceWord, including nested examples.
export function japaneseOf(q){
 const prompt=String(q.prompt||q.sourceWord||''),source=String(q.sourceWord||'');
 let text=source||prompt,reading=String(q.reading||q.furigana||q.kana||'');
 if(source&&prompt.startsWith(source)){
  const tail=prompt.slice(source.length).trim();
  if(/^[（(][\s\S]*[）)]$/.test(tail))reading ||= tail.slice(1,-1);
 }else if(!source){
  const match=prompt.match(/^(.*?)[（(]([ぁ-ゖァ-ヺー\s]+)[）)]\s*$/u);
  if(match){text=match[1].trim();reading ||= match[2];}
 }
 return {text,reading:kana(reading)};
}
export function rubyParts(text,reading){
 text=String(text??'');reading=kana(reading);
 if(!kanji.test(text)||!reading)return [{text}];
 const runs=text.match(/[\p{Script=Han}々〆0-9０-９]+(?:\s+(?=[\p{Script=Han}々〆0-9０-９])[\p{Script=Han}々〆0-9０-９]+)*|[^\p{Script=Han}々〆0-9０-９]+/gu)||[];
 function align(i,at){
  if(i===runs.length)return at===reading.length?[]:null;
  const text=runs[i],literal=reading.includes('(')?kana(text):kana(text).replace(/[()]/g,'');
  if(!annotatable.test(text)){
   if(!reading.startsWith(literal,at))return null;
   const tail=align(i+1,at+literal.length);return tail?[{text},...tail]:null;
  }
  for(let end=at+1;end<=reading.length;end++){
   const tail=align(i+1,end);if(tail)return [{text,reading:reading.slice(at,end)},...tail];
  }
  return null;
 }
 const fullReading=reading,aligned=align(0,0);if(aligned)return aligned;
 for(const variant of fullReading.split('/')){reading=variant;const parts=align(0,0);if(parts)return parts;}
 return [{text,reading:fullReading}];
}
export function rubyHTML(q){const {text,reading}=japaneseOf(q);return rubyParts(text,reading).map(p=>p.reading?'<ruby>'+escape(p.text)+'<rt>'+escape(p.reading)+'</rt></ruby>':escape(p.text)).join('');}
