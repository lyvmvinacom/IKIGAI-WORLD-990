export function profileStore(id,storage){
 const key=id?'ikigai:sakura:v35:'+id:null;
 const blank=()=>({sessions:0,answered:0,skipped:0,assisted:0,errors:{},practice:{}});
 let p=blank();try{if(key){const x=JSON.parse(storage.getItem(key));if(x&&typeof x==='object')p={...p,...x,errors:x.errors||{},practice:x.practice||{}}}}catch{}
 let saved=false;
 const save=()=>{try{if(key){storage.setItem(key,JSON.stringify(p));saved=true}}catch{saved=false}};
 return {p,save,get saved(){return saved},error(c){p.errors[c]=(p.errors[c]||0)+1;save()},answer(c,assisted){p.answered++;if(assisted)p.assisted++;p.practice[c]=(p.practice[c]||0)+1;save()},skip(){p.skipped++;save()},finish(){p.sessions++;save()}};
}
export function topic(row){const q=row[1];return /きのう|ました/.test(q)?'Thời quá khứ':/なんじに/.test(q)?'Trợ từ に':/なにで/.test(q)?'Trợ từ で':/だれと/.test(q)?'Trợ từ と':/なにを/.test(q)?'Trợ từ を':/すき|わかります/.test(q)?'Trợ từ が':/あります|います/.test(q)?'Tồn tại':/どう|どんな/.test(q)?'Tính từ':'Hỏi đáp cơ bản'}
export function difficulty(streak,hard){return hard>=2?0:streak>=3?2:1}
export function chooseNext(list,i,level,mode,errors,previous){
 const base=list[i+1];if(!base)return;
 // Only reorder nearby questions, never cross dependent follow-ups.
 if(/なんじまで|なにで|だれと|なんじから|なにを たべます|なにを のみます/.test(base[1]))return;
 const candidates=list.slice(i+1,i+4);if(candidates.some(r=>/なんじまで|なにで|だれと|なんじから|なにを たべます|なにを のみます/.test(r[1])))return;
 const score=r=> (mode===0?-r[0]*3:mode===2?r[0]*3:0)+Math.min(5,errors[topic(r)]||0)*2;
 let best=i+1;for(let j=i+2;j<Math.min(i+4,list.length);j++)if(list[j][0]<=level&&score(list[j])>score(list[best]))best=j;
 if(best!==i+1)[list[i+1],list[best]]=[list[best],list[i+1]];
}
