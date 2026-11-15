// Diary bridge for the classroom games, including the separate iPhone/iPad tab.
(()=>{'use strict';
const $=id=>document.getElementById(id),embedded=parent!==window;
let busy=false,last='';
function label(){
 const lesson=$('lesson')?.selectedOptions?.[0]?.textContent||'';
 if($('kb-game'))return $('kb-game').dataset.bombState==='playing'?'Kanji · Gỡ bom · '+($('kb-game').querySelector('[data-v="round"]')?.textContent.split(' · ')[0]||''):'';
 if($('bunpouXP'))return $('cover')?.hidden?'Ngữ pháp · Bunpou Tetris · '+lesson:'';
 return $('game')&&!$('game').hidden?'Từ vựng · Kotoba Ninja · '+lesson:'';
}
async function ping(force=false,ending=false){
 const activity=label();document.documentElement.dataset.diaryActivity=activity;
 if(embedded||busy)return;
 const body={p_room:'class',p_activity:activity,p_active:!ending&&document.visibilityState==='visible'},key=JSON.stringify(body);
 if(!force&&key===last)return;
 let session;for(const storage of [sessionStorage,localStorage])try{session=JSON.parse(storage.getItem('sb-vfimwlijbxamudirejiq-auth-token')||'null');if(session?.access_token)break}catch{}
 if(!session?.access_token||session.user?.is_anonymous)return;
 busy=true;try{const r=await fetch('https://vfimwlijbxamudirejiq.supabase.co/rest/v1/rpc/ikigai_diary_ping',{method:'POST',keepalive:ending,headers:{apikey:'sb_publishable_IETjbMWeJthqXscH9fkrXg_x2QZiL8D',Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});if(r.ok)last=key;else last=''}catch{last=''}finally{busy=false}
}
setInterval(()=>ping(true),20000);setInterval(()=>ping(),1000);document.addEventListener('visibilitychange',()=>ping(true));window.addEventListener('pagehide',()=>ping(true,true));ping(true);
})();
