(()=>{'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rooms={map:'Bản đồ',class:'Lớp học IKIGAI',arena:'Đấu trường',n4:'Luyện thi N4',n5:'Luyện thi N5',jft:'Luyện thi JFT A2',gym:'Gym',tea:'Phòng Trà'};
let getContext=()=>({}),scope=null,last='',busy=false,rows=[],profiles=[],request=0,previous=null,refreshTimer=null,loading=false,loaded=false,windowDay='',lastUpdated=null,liveChannel=null,liveClient=null,live=false,renderTimer=null,pendingRows=[];
const teacher=()=>{const c=getContext();return c.role==='teacher'&&c.user?.app_metadata?.role==='teacher'};
const visible=n=>n?.isConnected&&!n.closest('[hidden]');
const dayOf=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const dates=()=>Array.from({length:5},(_,i)=>{const t=new Date();t.setUTCDate(t.getUTCDate()-i);return dayOf(t)});
const formatDay=d=>d.split('-').reverse().join('/');
const duration=n=>{const seconds=Math.floor(Number(n||0)),m=Math.floor(seconds/60),sec=seconds%60;return m>=60?Math.floor(m/60)+' giờ '+m%60+' phút '+sec+' giây':m?m+' phút '+sec+' giây':seconds+' giây'};
const viewing=()=>!$('learningDiary').hidden&&teacher();
const selectedDates=()=>{const selected=$('diaryDays').value;return selected==='all'?dates():dates().filter(d=>d===selected)};
function paintDates(){
 const days=dates(),selected=$('diaryDays').value||'all';
 if(windowDay===days[0])return;
 windowDay=days[0];$('diaryDays').innerHTML='<option value="all">5 ngày gần nhất</option>'+days.map((d,i)=>'<option value="'+d+'">'+(i===0?'Hôm nay · ':i===1?'Hôm qua · ':'')+formatDay(d)+'</option>').join('');
 $('diaryDays').value=days.includes(selected)?selected:'all';
}
function status(error=''){
 const el=$('diaryLiveStatus');if(!el)return;
 el.classList.toggle('diary-live-error',!!error);
 el.textContent=error?'Chưa kết nối · sẽ tự thử lại: '+error:(live?'● Đang cập nhật trực tiếp':'● Tự cập nhật mỗi 5 giây')+(lastUpdated?' · Lần gần nhất '+lastUpdated.toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):' · Đang kết nối…');
}
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
setInterval(()=>ping(true),5000);setInterval(()=>ping(),1500);
document.addEventListener('visibilitychange',()=>ping(true));window.addEventListener('pagehide',()=>ping(true,true));
function close(){request++;stopLive();clearInterval(refreshTimer);refreshTimer=null;$('learningDiary').hidden=true;previous?.focus()}
function stopLive(){
 live=false;clearTimeout(renderTimer);renderTimer=null;
 const channel=liveChannel,client=liveClient;liveChannel=null;liveClient=null;
 if(channel)Promise.resolve(client.removeChannel(channel)).catch(()=>{});
}
function mergeRow(row){
 if(!row?.user_id||!dates().includes(row.day))return;
 const i=rows.findIndex(r=>r.user_id===row.user_id&&r.day===row.day&&r.room===row.room&&r.activity===row.activity);
 if(i<0)rows.push(row);else if(String(row.last_seen)>=String(rows[i].last_seen||''))rows[i]=row;
}
function startLive(){
 stopLive();const client=getContext().client;if(typeof client.channel!=='function')return;
 liveClient=client;const channel=client.channel('teacher-learning-diary-'+getContext().user.id+'-'+Date.now());liveChannel=channel;
 const receive=payload=>{
  if(liveChannel!==channel||!viewing())return;
  if(loading){pendingRows.push(payload.new);return}
  mergeRow(payload.new);lastUpdated=new Date();status();clearTimeout(renderTimer);renderTimer=setTimeout(()=>{if(viewing())render()},150);
 };
 channel.on('postgres_changes',{event:'INSERT',schema:'public',table:'ikigai_learning_diary'},receive)
 .on('postgres_changes',{event:'UPDATE',schema:'public',table:'ikigai_learning_diary'},receive)
 .subscribe(state=>{if(liveChannel!==channel||!viewing())return;live=state==='SUBSCRIBED';status();if(live)load(true)});
}
async function pageAll(table,columns,filter){const c=getContext().client,out=[];for(let start=0;;start+=1000){let q=c.from(table).select(columns).order('user_id').order(table==='ikigai_learning_diary'?'day':'nickname').order(table==='ikigai_learning_diary'?'room':'role').order(table==='ikigai_learning_diary'?'activity':'xp').range(start,start+999);if(filter)q=filter(q);const {data,error}=await q;if(error)throw error;out.push(...data);if(data.length<1000)return out}}
async function load(quiet=false){
 if(!teacher())return close();if(loading||!viewing()||document.visibilityState!=='visible')return;
 const seq=request;loading=true;pendingRows=[];paintDates();
 if(!quiet&&!loaded)$('diaryBody').innerHTML='<p role="status">Đang tải nhật ký…</p>';
 try{
  const result=await Promise.all([pageAll('ikigai_learning_diary','*',q=>q.gte('day',dates().at(-1)).lte('day',dates()[0])),pageAll('ikigai_world_profiles','user_id,nickname,role,xp')]);
  if(seq!==request||!viewing())return;
  [rows,profiles]=result;pendingRows.forEach(mergeRow);pendingRows=[];loaded=true;lastUpdated=new Date();render();status();
 }catch(e){if(seq!==request||!viewing())return;status(e.message);if(!loaded)$('diaryBody').innerHTML='<p role="alert">Chưa tải được nhật ký. Hệ thống sẽ tự thử lại.</p>'}
 finally{loading=false}
}
function render(){
 if(!teacher())return close();paintDates();const chosen=selectedDates(),scopeLabel=chosen.length===1?formatDay(chosen[0]):'5 ngày',visibleRows=rows.filter(r=>chosen.includes(r.day));const body=$('diaryBody'),scroll=body.scrollTop,opened=new Set([...body.querySelectorAll('.diary-account[open]')].map(el=>el.dataset.user)),focused=document.activeElement?.closest('.diary-account')?.dataset.user;const query=$('diarySearch').value.trim().toLocaleLowerCase('vi');
 const users=new Map(profiles.filter(p=>p.role!=='teacher').map(p=>[p.user_id,p]));
 for(const row of visibleRows)if(!users.has(row.user_id)&&!profiles.some(p=>p.user_id===row.user_id&&p.role==='teacher'))users.set(row.user_id,{user_id:row.user_id,nickname:'Tài khoản '+row.user_id.slice(0,8)});
 const totals=new Map();for(const r of visibleRows)totals.set(r.user_id,(totals.get(r.user_id)||0)+Number(r.online_seconds));
 const sort=$('diarySort').value;const list=[...users.values()].filter(p=>(p.nickname+' '+p.user_id).toLocaleLowerCase('vi').includes(query)).sort((a,b)=>(sort==='online'?(totals.get(b.user_id)||0)-(totals.get(a.user_id)||0):sort==='xp'?Number(b.xp||0)-Number(a.xp||0):0)||String(a.nickname).localeCompare(String(b.nickname),'vi'));
 $('diaryBody').innerHTML=list.length?list.map((p,i)=>'<details class="diary-account" data-user="'+esc(p.user_id)+'"'+(opened.has(p.user_id)?' open':'')+'><summary><b>#'+(i+1)+' · '+esc(p.nickname||'Học viên')+'</b><small>'+esc(p.user_id.slice(0,8))+' · '+Number(p.xp||0).toLocaleString('vi-VN')+' EXP · '+(totals.has(p.user_id)?duration(totals.get(p.user_id)):'Chưa có dữ liệu')+' / '+scopeLabel+'</small></summary><div class="diary-days">'+chosen.map(day=>{
 const rs=visibleRows.filter(r=>r.user_id===p.user_id&&r.day===day),sum=rs.reduce((n,r)=>n+Number(r.online_seconds),0),study=rs.filter(r=>r.activity);
 return '<article><header><b>'+formatDay(day)+'</b><span>Online: '+(rs.length?duration(sum):'Chưa có dữ liệu')+'</span></header>'+(study.length?'<ul>'+study.sort((a,b)=>a.first_seen.localeCompare(b.first_seen)).map(r=>'<li><strong>'+esc(r.activity)+'</strong><small>'+esc(rooms[r.room]||r.room)+' · '+duration(r.online_seconds)+'</small></li>').join('')+'</ul>':rs.length?'<p>Chưa ghi nhận mở bài học; có mặt ở '+[...new Set(rs.map(r=>rooms[r.room]||r.room))].map(esc).join(', ')+'.</p>':'<p>Chưa có nhật ký được ghi nhận cho ngày này.</p>')+'</article>'
 }).join('')+'</div></details>').join(''):'<p>Không có tài khoản phù hợp.</p>';
 body.scrollTop=scroll;if(focused)[...body.querySelectorAll('.diary-account')].find(el=>el.dataset.user===focused)?.querySelector('summary')?.focus({preventScroll:true});
}
function open(){if(!teacher())return;previous=document.activeElement;request++;$('learningDiary').hidden=false;paintDates();$('diaryClose').focus();startLive();status();load();clearInterval(refreshTimer);refreshTimer=setInterval(()=>load(true),5000)}
$('openLearningDiary').onclick=open;$('diaryClose').onclick=close;$('diaryRefresh').onclick=()=>load();$('diarySearch').oninput=render;$('diarySort').onchange=render;$('diaryDays').onchange=render;document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&viewing())load(true)});
$('learningDiary').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close()}if(e.key==='Tab'){const nodes=[...$('learningDiary').querySelectorAll('button,input,select,summary')].filter(visible),first=nodes[0],end=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();end.focus()}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first.focus()}}});
})();
