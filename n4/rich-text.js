// A small, text-only notation: {漢字|かんじ} and [[underlined text]].
// Never accept HTML from imported questions or the teacher editor.
export const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function japanese(value){
 const text=String(value??'');
 const token=/\{([^{}|\n]{1,80})\|([^{}|\n]{1,120})\}|\[\[([\s\S]*?)\]\]/g;
 let output='',start=0,match;
 while((match=token.exec(text))){
  output+=escapeText(text.slice(start,match.index));
  output+=match[3]!==undefined?'<u>'+japanese(match[3])+'</u>':'<ruby>'+escapeText(match[1])+'<rp>（</rp><rt>'+escapeText(match[2])+'</rt><rp>）</rp></ruby>';
  start=token.lastIndex;
 }
 return output+escapeText(text.slice(start));
}
export function validateNotation(value){
 const rest=String(value??'').replace(/\{([^{}|\n]{1,80})\|([^{}|\n]{1,120})\}/g,'');
 let depth=0;
 for(const mark of rest.match(/\[\[|\]\]/g)||[]){depth+=mark==='[['?1:-1;if(depth<0||depth>1)throw Error('Gạch chân cần đúng mẫu [[nội dung]].')}
 if(depth||/[{}]/.test(rest))throw Error('Furigana chưa đúng mẫu {漢字|かんじ} hoặc gạch chân [[nội dung]].');
}
