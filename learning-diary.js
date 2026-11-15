(()=>{'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rooms={map:'Bản đồ',class:'Lớp học IKIGAI',arena:'Đấu trường',n4:'Luyện thi N4',n5:'Luyện thi N5',jft:'Luyện thi JFT A2',gym:'Gym',tea:'Phòng Trà'};
let getContext=()=>({}),scope=null,last='',busy=false,rows=[],profiles=[],days=5,request=0,previous=null;
const teacher=()=>{const c=getContext();return c.role==='teacher'&&c.user?.app_metadata?.role==='teacher'};
const visible=n=>n?.isConnected&&!n.closest('[hidden]');
const dayOf=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const dates=()=>Array.from({length:days},(_,i)=>{const t=new Date();t.setUTCDate(t.getUTCDate()-i);return dayOf(t)});
const duration=n=>{const m=Math.floor(Number(n||0)/60);return m>=60?Math.floor(m/60)+' giờ '+m%60+' phút':m?m+' phút':Number(n)>0?'< 1 phút':'0 phút'};
function activity(){
 if(scope&&visible(scope.node))return scope.label;
 for(const [id,label] of [['kotobaNinjaOverlay','Từ vựng · Kotoba Ninja'],['bunpouTetrisOverlay','Ngữ pháp · Bunpou Tetris'],['kanjiBombOverlay','Kanji · Gỡ bom']]){
  const overlay=$(id);if(!visible(overlay))continue;
  try{const doc=overlay.querySelector('iframe')?.contentDocument;if(doc?.documentElement.hasAttribute('data-diary-activity'))return doc.documentElement.dataset.diaryActivity;return label}catch{return label}
 }
 return '';
}
async function ping(force=false,ending=false){
 const c=getContext();if(!c.client||!c.user||c.user.is_anonymous||c.role==='guest'||busy)return;
 const payload={p_room:c.place||'map',p_activity:activity(),p_active:!ending&&document.visibilityState==='visible'};
 const key=JSON.stringify(payload);if(!force&&key===last)return;
 busy=true;try{const {error}=await c.client.rpc('ikigai_diary_ping',payload);if(error)throw error;last=key}catch{last=''}finally{busy=false}
}
window.IKIGAI_DIARY={
 init(context){getContext=context;const b=$('openLearningDiary');if(b)b.hidden=!teacher();void ping(true)},
 study(label,node){scope=label?{label:String(label).slice(0,180),node}:null;void ping(true)},
 flush:()=>ping(true,true)
};
// Visibility stops the clock. A missing heartbeat never credits a long disconnected gap.
setInterval(()=>ping(true),20000);setInterval(()=>ping(),1500);
document.addEventListener('visibilitychange',()=>ping(true));window.addEventListener('pagehide',()=>ping(true,true));
function close(){request++;$('learningDiary').hidden=true;previous?.focus()}
async function pageAll(table,columns,filter){const c=getContext().client,out=[];for(let start=0;;start+=1000){let q=c.from(table).select(columns).order('user_id').order(table==='ikigai_learning_diary'?'day':'nickname').order(table==='ikigai_learning_diary'?'room':'role').order(table==='ikigai_learning_diary'?'activity':'xp').range(start,start+999);if(filter)q=filter(q);const {data,error}=await q;if(error)throw error;out.push(...data);if(data.length<1000)return out}}
async function load(){
 if(!teacher())return close();const seq=++request;$('diaryBody').innerHTML='<p role="status">Đang tải nhật ký…</p>';
 try{const result=await Promise.all([pageAll('ikigai_learning_diary','*',q=>q.gte('day',dates().at(-1)).lte('day',dates()[0])),pageAll('ikigai_world_profiles','user_id,nickname,role,xp')]);if(seq!==request||!teacher())return;[rows,profiles]=result;render()}
 catch(e){if(seq===request)$('diaryBody').innerHTML='<p role="alert">Chưa tải được nhật ký. '+esc(e.message)+'</p>'}
}
function render(){
 if(!teacher())return close();const query=$('diarySearch').value.trim().toLocaleLowerCase('vi');
 const users=new Map(profiles.filter(p=>p.role!=='teacher').map(p=>[p.user_id,p]));
 for(const row of rows)if(!users.has(row.user_id)&&!profiles.some(p=>p.user_id===row.user_id&&p.role==='teacher'))users.set(row.user_id,{user_id:row.user_id,nickname:'Tài khoản '+row.user_id.slice(0,8)});
 const totals=new Map();for(const r of rows)totals.set(r.user_id,(totals.get(r.user_id)||0)+Number(r.online_seconds));
 const sort=$('diarySort').value;const list=[...users.values()].filter(p=>(p.nickname+' '+p.user_id).toLocaleLowerCase('vi').includes(query)).sort((a,b)=>(sort==='online'?(totals.get(b.user_id)||0)-(totals.get(a.user_id)||0):sort==='xp'?Number(b.xp||0)-Number(a.xp||0):0)||String(a.nickname).localeCompare(String(b.nickname),'vi'));
 $('diaryBody').innerHTML=list.length?list.map((p,i)=>'<details class="diary-account"><summary><b>#'+(i+1)+' · '+esc(p.nickname||'Học viên')+'</b><small>'+esc(p.user_id.slice(0,8))+' · '+Number(p.xp||0).toLocaleString('vi-VN')+' EXP · '+(totals.has(p.user_id)?duration(totals.get(p.user_id)):'Chưa có dữ liệu')+' / '+days+' ngày</small></summary><div class="diary-days">'+dates().map(day=>{
 const rs=rows.filter(r=>r.user_id===p.user_id&&r.day===day),sum=rs.reduce((n,r)=>n+Number(r.online_seconds),0),study=rs.filter(r=>r.activity);
 return '<article><header><b>'+day.split('-').reverse().join('/')+'</b><span>Online: '+(rs.length?duration(sum):'Chưa có dữ liệu')+'</span></header>'+(study.length?'<ul>'+study.sort((a,b)=>a.first_seen.localeCompare(b.first_seen)).map(r=>'<li><strong>'+esc(r.activity)+'</strong><small>'+esc(rooms[r.room]||r.room)+' · '+duration(r.online_seconds)+'</small></li>').join('')+'</ul>':rs.length?'<p>Chưa ghi nhận mở bài học; có mặt ở '+[...new Set(rs.map(r=>rooms[r.room]||r.room))].map(esc).join(', ')+'.</p>':'<p>Chưa có nhật ký được ghi nhận cho ngày này.</p>')+'</article>'
 }).join('')+'</div></details>').join(''):'<p>Không có tài khoản phù hợp.</p>';
}
function open(){if(!teacher())return;previous=document.activeElement;$('learningDiary').hidden=false;$('diaryClose').focus();load()}
$('openLearningDiary').onclick=open;$('diaryClose').onclick=close;$('diaryRefresh').onclick=load;$('diarySearch').oninput=render;$('diarySort').onchange=render;$('diaryDays').onchange=e=>{days=Number(e.target.value);load()};
$('learningDiary').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close()}if(e.key==='Tab'){const nodes=[...$('learningDiary').querySelectorAll('button,input,select,summary')].filter(visible),first=nodes[0],end=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();end.focus()}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first.focus()}}});
})();
