(()=>{'use strict';
// IKIGAI WORLD 9.1 — commercial-style overworld art integration

const SUPABASE_URL='https://vfimwlijbxamudirejiq.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_IETjbMWeJthqXscH9fkrXg_x2QZiL8D';
const ROOM='ikigai-world-main';
const $=id=>document.getElementById(id),safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const musicToggleNode=$('musicToggle');
const musicToggleHome=document.createComment('IKIGAI music toggle home');
if(musicToggleNode?.parentNode)musicToggleNode.parentNode.insertBefore(musicToggleHome,musicToggleNode);
function mountRoomMusicToggle(){const slot=$('roomMusicSlot');if(slot&&musicToggleNode)slot.appendChild(musicToggleNode);}
function restoreMusicToggle(){if(musicToggleNode&&musicToggleHome.parentNode)musicToggleHome.parentNode.insertBefore(musicToggleNode,musicToggleHome.nextSibling);}

let client=null,channel=null,user=null,nickname='',role='student',gender='male',avatar=0,joined=false,bank=[],currentPlace='',qset=[],qpos=0,score=0,activeGroup='',myPos={x:50,y:70},roomPos={x:50,y:70},people={},moving=false,lastSend=0,moveLoop=null,keys={},xp=0,coins=0,profileLoaded=false,awardBusy=false,arenaMode='',arenaReady=false,arenaTimer=null;
const stateKey='ikigaiWorld3Player';
const placeData={class:['Lớp học IKIGAI','Nơi học từ vựng, ngữ pháp và Kanji cùng リー先生.'],arena:['Đấu trường IKIGAI','Đấu tập kiến thức N5 với bạn bè.'],n4:['Phòng luyện thi N4','Khu vực đã sẵn sàng; ngân hàng N4 sẽ được kết nối khi có dữ liệu.'],n5:['Phòng luyện thi N5','Ôn tập từ vựng, ngữ pháp, Kanji, đọc hiểu và nghe hiểu.'],jft:['Phòng luyện thi JFT','Khu vực JFT-Basic A2. Đề thi sẽ được kết nối theo bộ dữ liệu JFT riêng.'],gym:['Phòng Gym','Gặp huấn luyện viên và hoàn thành thử thách vận động an toàn.'],tea:['Phòng Trà IKIGAI','Không gian thưởng trà và giao lưu của IKIGAI. “Uống trà với anh nhé”.']};
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>$('toast').classList.remove('show'),2600)}
function save(){ $('xp').textContent=String(xp);$('coins').textContent=String(coins);$('level').textContent=String(Math.floor(xp/100)+1);$('progressSource').textContent=profileLoaded?'Đồng bộ tài khoản':'Chưa đồng bộ'; }
function asset(g,a){return `assets/characters/${g==='female'?(a%2?'female_glasses.png':'female_pink.png'):(a%2?'male_hoodie.png':'male_school.png')}`}
function avatarMarkup(p,isMe=false){const img=p.role==='teacher'?'assets/characters/teacher_lee.png':asset(p.gender||'male',p.avatar||0);return `<div class="actor ${isMe?'me':''} ${p.role==='teacher'?'teacher':''}" data-id="${safe(p.id)}" style="left:${p.x??50}%;top:${p.y??70}%" data-direction="${safe(p.direction||'down')}"><div class="speech"></div><img src="${img}" alt=""><div class="name">${safe(p.name||'Học viên')}</div></div>`}
function setLoginTab(tab){document.querySelectorAll('.login-tabs button').forEach(b=>b.classList.toggle('selected',b.dataset.tab===tab));$('studentForm').hidden=tab!=='student';$('teacherForm').hidden=tab!=='teacher'}
document.querySelectorAll('.login-tabs button').forEach(b=>b.onclick=()=>setLoginTab(b.dataset.tab));
document.querySelectorAll('[data-gender]').forEach(b=>b.onclick=()=>{gender=b.dataset.gender;document.querySelectorAll('[data-gender]').forEach(x=>x.classList.toggle('selected',x===b));updateAvatar()});
function updateAvatar(){$('avatarPreview').src=asset(gender,avatar)}
$('avatarPrev').onclick=()=>{avatar=(avatar+1)%2;updateAvatar()};$('avatarNext').onclick=()=>{avatar=(avatar+1)%2;updateAvatar()};
function setup(){if(!window.supabase){$('loginStatus').textContent='Không tải được thư viện kết nối. Hãy kiểm tra Internet.';return false}client=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);return true}
async function studentAuth(signup){const email=$('studentEmail').value.trim(),password=$('studentPassword').value;nickname=$('studentName').value.trim();if(!nickname||!email||password.length<6){$('loginStatus').textContent='Nhập tên, email và mật khẩu từ 6 ký tự trở lên.';return}if(!setup())return;setBusy(true);try{if(signup){const {data,error}=await client.auth.signUp({email,password,options:{data:{nickname,role:'student',gender,avatar}}});if(error)throw error;if(!data.session){$('loginStatus').textContent='Tài khoản đã tạo. Hãy xác nhận email nếu Supabase yêu cầu, sau đó đăng nhập.';setBusy(false);return}user=data.user}else{const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;user=data.user;nickname=user.user_metadata?.nickname||nickname||email.split('@')[0];gender=user.user_metadata?.gender||gender;avatar=Number(user.user_metadata?.avatar||0)}role='student';await enterWorld()}catch(e){$('loginStatus').textContent=translateError(e.message);setBusy(false)}}
function translateError(s){if(/Invalid login credentials/i.test(s))return 'Email hoặc mật khẩu chưa đúng.';if(/already registered/i.test(s))return 'Email này đã có tài khoản. Hãy chọn Đăng nhập.';if(/Email not confirmed/i.test(s))return 'Email chưa được xác nhận. Hãy kiểm tra hộp thư.';return s}
function setBusy(v){$('studentSignIn').disabled=v;$('studentSignUp').disabled=v;$('teacherSignIn').disabled=v;$('guestEnter').disabled=v}
async function teacherAuth(){const email=$('teacherEmail').value.trim(),password=$('teacherPassword').value;if(!email||!password){$('loginStatus').textContent='Nhập email và mật khẩu giáo viên.';return}if(!setup())return;setBusy(true);try{const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;if(data.user.app_metadata?.role!=='teacher'){await client.auth.signOut();throw new Error('Tài khoản chưa được cấp quyền teacher trong Supabase.')}user=data.user;role='teacher';nickname='リー先生';gender='male';avatar=0;await enterWorld()}catch(e){$('loginStatus').textContent=translateError(e.message);setBusy(false)}}
async function guest(){nickname=$('studentName').value.trim()||'Khách IKIGAI';if(!setup())return;setBusy(true);try{const {data,error}=await client.auth.signInAnonymously();if(error)throw error;user=data.user;role='guest';await enterWorld()}catch(e){$('loginStatus').textContent='Không vào được chế độ khách: '+e.message;setBusy(false)}}
$('studentSignIn').onclick=()=>studentAuth(false);$('studentSignUp').onclick=()=>studentAuth(true);$('teacherSignIn').onclick=teacherAuth;$('guestEnter').onclick=guest;
async function enterWorld(){if(!user)throw Error('Chưa xác thực tài khoản');$('login').hidden=true;window.IKIGAI_AUDIO?.play('map');$('hudName').textContent=nickname;$('hudRole').textContent=role==='teacher'?'GIÁO VIÊN · リー先生':role==='guest'?'KHÁCH · PHIÊN TẠM':'HỌC VIÊN IKIGAI';$('hudAvatar').textContent=role==='teacher'?'👨🏻‍🏫':'🌸';await loadPlayerProfile();save();await connectRealtime();await loadBank();renderActors();toast('🌸 Chào mừng '+nickname+' đến IKIGAI WORLD!')}
async function connectRealtime(){if(channel){try{await client.removeChannel(channel)}catch(e){}}joined=false;channel=client.channel(ROOM,{config:{presence:{key:user.id},broadcast:{self:false}}});
channel.on('presence',{event:'sync'},()=>{const state=channel.presenceState();people={};Object.values(state).flat().forEach(p=>{if(p.user_id!==user.id)people[p.user_id]=p});renderActors();renderMembers();if(!$('roomScene').hidden){renderRoomPeers();}updateArenaLobby()});
channel.on('broadcast',{event:'position'},({payload})=>{if(!payload||payload.user_id===user.id)return;const p=people[payload.user_id]||{};Object.assign(p,payload);people[payload.user_id]=p;updateActor(payload);renderMembers()});
channel.on('broadcast',{event:'chat'},({payload})=>{if(payload?.user_id!==user.id){const scene=$('roomScene').hidden?'map':'room';if(payload?.scene===scene&&(scene!=='room'||payload?.place===currentPlace)){addMessage(payload.name,payload.text,payload.role==='teacher');if(scene==='room')showBubble(payload.user_id,payload.text)}}});
channel.on('broadcast',{event:'bubble'},({payload})=>{if(payload?.user_id!==user.id)showBubble(payload.user_id,payload.text)});
channel.on('broadcast',{event:'scene'},({payload})=>{if(payload?.user_id!==user.id&&payload?.scene==='room')toast(`${payload.name} đã vào ${placeData[payload.place]?.[0]||'một phòng'}`)});
const status=await new Promise(resolve=>{const timer=setTimeout(()=>resolve('TIMEOUT'),10000);channel.subscribe(async s=>{if(s==='SUBSCRIBED'){clearTimeout(timer);joined=true;await channel.track(profile());$('connectionStatus')?.classList.add('connected');resolve(s)}else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'){clearTimeout(timer);resolve(s)}})});
if(status!=='SUBSCRIBED')toast('Chưa kết nối được máy chủ nhiều người chơi. Bạn vẫn có thể học cục bộ.');}
function profile(){return {user_id:user.id,id:user.id,name:nickname,role:role==='teacher'?'teacher':role==='guest'?'guest':'student',gender,avatar,x:myPos.x,y:myPos.y,moving:!!myPos.moving,direction:myPos.direction||'down',scene:$('roomScene').hidden?'map':'room',place:currentPlace||'map',roomX:roomPos.x,roomY:roomPos.y,xp:Number(xp||0),level:Math.floor(Number(xp||0)/100)+1,online_at:new Date().toISOString()}}
async function loadPlayerProfile(){xp=0;coins=0;profileLoaded=false;if(role==='guest'){save();return}try{const {data,error}=await client.rpc('ikigai_ensure_profile',{p_nickname:nickname,p_gender:gender,p_avatar:avatar});if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(row){nickname=row.nickname||nickname;gender=row.gender||gender;avatar=Number(row.avatar||0);xp=Number(row.xp||0);coins=Number(row.coins||0)}profileLoaded=true;$('hudName').textContent=nickname;save()}catch(e){console.error('Profile sync:',e);toast('Chưa đồng bộ được hồ sơ/XP. Hãy chạy SQL 3.2 trong Supabase.');save()}}
async function persistAward(){if(role==='guest'||!profileLoaded||awardBusy)return false;awardBusy=true;try{const {data,error}=await client.rpc('ikigai_award_quiz',{p_xp:score*10,p_coins:Math.max(0,Math.floor(score*2)),p_correct:score,p_total:qset.length,p_attempt_id:crypto.randomUUID()});if(error)throw error;xp=Number(data?.xp??xp);coins=Number(data?.coins??coins);save();if(channel&&joined)await channel.track(profile());if(currentPlace==='class')renderClassLeaderboard();return true}catch(e){console.error('Award sync:',e);toast('Kết quả đã chấm nhưng chưa cộng thưởng lên tài khoản. Cần kiểm tra RPC Supabase.');return false}finally{awardBusy=false}}
function renderActors(){/* Gunny-style: map is scenery only; sprites appear after entering a room. */$('mapActors').innerHTML='';$('onlineCount').textContent=String(Object.keys(people).length+1)}
function bindActorClicks(){document.querySelectorAll('.actor').forEach(el=>el.onclick=()=>{const id=el.dataset.id;if(id===user.id){toast('Đây là nhân vật của bạn.');return}const p=people[id];if(p){showBubble(id,'こんにちは '+nickname+'! 一緒に勉強しよう！');sendBubble(id,'こんにちは! 👋')}})}
function updateActor(p){const el=document.querySelector(`.actor[data-id="${CSS.escape(p.user_id)}"]`);if(el){el.style.left=p.x+'%';el.style.top=p.y+'%';el.classList.toggle('walking',!!p.moving);if(p.direction)el.dataset.direction=p.direction;if(p.gender||p.avatar!==undefined){const img=el.querySelector('img');img.src=p.role==='teacher'?'assets/characters/teacher_lee.png':asset(p.gender,p.avatar)}}const re=$('roomScene').querySelector(`.room-actor[data-id="${CSS.escape(p.user_id)}"]`);if(re){re.style.left=(p.roomX||50)+'%';re.style.top=(p.roomY||70)+'%'}else if(!$('roomScene').hidden&&p.scene==='room'&&p.place===currentPlace)renderRoomPeers();if(!el&&$('roomScene').hidden)renderActors()}
function renderMembers(){const arr=[{user_id:user.id,name:nickname,role,gender,avatar},...Object.values(people)];$('members').innerHTML=arr.map(p=>`<div class="member-row"><img src="${p.role==='teacher'?'assets/characters/teacher_lee.png':asset(p.gender,p.avatar||0)}"><span><b>${safe(p.name)}</b><br><small>${p.role==='teacher'?'Giáo viên':'Học viên'}</small></span></div>`).join('')}
function addMessage(name,text,teacher=false){const d=document.createElement('div');d.className='message';d.innerHTML=`<b>${safe(name)}</b><small>${new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</small><br>${safe(text)}`;$('messages').appendChild(d);$('messages').scrollTop=$('messages').scrollHeight}
function sendChat(text){text=text.trim();if(!text)return;addMessage(nickname,text,role==='teacher');if(!$('roomScene').hidden)showBubble('me',text);if(channel&&joined)channel.send({type:'broadcast',event:'chat',payload:{user_id:user.id,name:nickname,text,role,scene:$('roomScene').hidden?'map':'room',place:currentPlace||'map'}})}
$('chatForm').onsubmit=e=>{e.preventDefault();sendChat($('chatInput').value);$('chatInput').value=''};
$('chatToggle').onclick=()=>$('chatbox').classList.toggle('open');$('closeChat').onclick=()=>$('chatbox').classList.remove('open');$('closeMembers').onclick=()=>$('memberbox').classList.remove('open');
function showBubble(id,text){const root=$('roomScene').hidden?document:$('roomScene');const actor=root.querySelector(`.room-actor[data-id="${CSS.escape(id)}"], .actor[data-id="${CSS.escape(id)}"]`);if(!actor)return;let el=actor.querySelector('.speech');if(!el){el=document.createElement('div');el.className='speech';actor.prepend(el)}el.textContent=String(text||'').slice(0,120);el.classList.add('show');clearTimeout(el._bubbleTimer);el._bubbleTimer=setTimeout(()=>el.classList.remove('show'),5000)}
function sendBubble(id,text){if(channel&&joined)channel.send({type:'broadcast',event:'bubble',payload:{user_id:user.id,target:id,text}})}
const dirs={up:[0,-.8],down:[0,.8],left:[-.8,0],right:[.8,0]};function move(dir){const [dx,dy]=dirs[dir]||[0,0];if($('roomScene').hidden){myPos.x=Math.max(4,Math.min(96,myPos.x+dx));myPos.y=Math.max(12,Math.min(94,myPos.y+dy));myPos.direction=dir;myPos.moving=true;const el=document.querySelector('.actor.me');if(el){el.style.left=myPos.x+'%';el.style.top=myPos.y+'%';el.classList.add('walking');el.dataset.direction=dir;clearTimeout(el.walkTimer);el.walkTimer=setTimeout(()=>el.classList.remove('walking'),220)}}else{roomPos.x=Math.max(4,Math.min(96,roomPos.x+dx*1.5));roomPos.y=Math.max(10,Math.min(88,roomPos.y+dy*1.5));myPos.direction=dir;myPos.moving=true;const el=$('roomScene').querySelector('.room-actor.me');if(el){el.style.left=roomPos.x+'%';el.style.top=roomPos.y+'%';el.classList.add('walking');el.dataset.direction=dir;clearTimeout(el.walkTimer);el.walkTimer=setTimeout(()=>el.classList.remove('walking'),220)}}sendPosition()}
function sendPosition(){if(!channel||!joined||Date.now()-lastSend<70)return;lastSend=Date.now();channel.send({type:'broadcast',event:'position',payload:{user_id:user.id,name:nickname,role,gender,avatar,x:myPos.x,y:myPos.y,roomX:roomPos.x,roomY:roomPos.y,scene:$('roomScene').hidden?'map':'room',place:currentPlace,moving:true,direction:myPos.direction||'down'}})}
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;const map={ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'};if(map[e.key]){e.preventDefault();if(!keys[e.key])move(map[e.key]);keys[e.key]=true}});
document.addEventListener('keyup',e=>{keys[e.key]=false;if(!Object.values(keys).some(Boolean)){const el=document.querySelector('.actor.me,.room-actor.me');el?.classList.remove('walking');if(myPos.moving){myPos.moving=false;sendPosition()}}});window.addEventListener('blur',()=>{keys={};document.querySelectorAll('.actor.me,.room-actor.me').forEach(el=>el.classList.remove('walking'));myPos.moving=false;sendPosition()});
document.querySelectorAll('#roomScene [data-dir]').forEach(b=>{const d=b.dataset.dir;const start=e=>{e.preventDefault();move(d);clearInterval(b.repeat);b.repeat=setInterval(()=>move(d),90)};const end=()=>clearInterval(b.repeat);b.addEventListener('pointerdown',start);['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,end))});
function showPlace(p){currentPlace=p;$('placeTitle').textContent=placeData[p][0];$('placeDescription').textContent=placeData[p][1];$('placeModal').hidden=false}
document.querySelectorAll('.hotspot').forEach(b=>b.onclick=()=>showPlace(b.dataset.place));$('closePlace').onclick=()=>$('placeModal').hidden=true;$('enterPlace').onclick=()=>{ $('placeModal').hidden=true;enterPlace(currentPlace)};
function roomCharacter(p,id='me',name=nickname,roleValue=role,genderValue=gender,avatarValue=avatar){const img=roleValue==='teacher'?'assets/characters/teacher_lee.png':asset(genderValue,avatarValue);const staticNpc=id==='teacher-npc';const isPeer=id!=='me'&&!staticNpc;return `<div class="room-actor ${id==='me'?'me':''} ${roleValue==='teacher'?'teacher-actor':''} ${staticNpc?'static-npc':''}" data-id="${safe(id)}" ${isPeer?'data-peer="true"':''} style="left:${p.x??50}%;top:${p.y??70}%" data-direction="${safe(p.direction||'down')}"><div class="speech"></div><img src="${img}"><span>${safe(name)}</span></div>`}
function roomStations(keys,locked=false){const labels={vocabulary:['📖','TỪ VỰNG'],grammar:['📝','NGỮ PHÁP'],kanji:['🈶','KANJI'],reading:['📄','ĐỌC HIỂU'],listening:['🎧','NGHE HIỂU'],mock:['🏆','THI THỬ']};return `<div class="station-grid">${keys.map(k=>`<button class="station" data-action="${k}" ${locked?'disabled':''}><span>${labels[k][0]}</span>${labels[k][1]}${locked?'<small>Chưa có dữ liệu</small>':''}</button>`).join('')}</div>`}
function roomFloatingNav(p){
const sets={
class:[['vocabulary','📖','Từ vựng'],['grammar','📝','Ngữ pháp'],['kanji','漢','Kanji'],['kaiwa','💬','Kaiwa'],['listening','🎧','Nghe hiểu']],
n5:[['vocabulary','📖','Từ vựng'],['grammar','📝','Ngữ pháp'],['kanji','漢','Kanji'],['listening','🎧','Nghe hiểu'],['mock','🏆','Thi thử']],
n4:[['vocabulary','📖','Từ vựng'],['grammar','📝','Ngữ pháp'],['kanji','漢','Kanji'],['listening','🎧','Nghe hiểu'],['mock','🏆','Thi thử']],
jft:[['vocabulary','📖','Từ vựng'],['reading','📄','Đọc hiểu'],['listening','🎧','Nghe hiểu'],['mock','🏆','Thi thử']],
arena:[['duel','⚔️','Đấu tập'],['rules','📜','Luật chơi']],
gym:[['gym','💪','Thử thách']],
tea:[['tea','🍵','Thưởng trà']]
};
const items=sets[p]||[];
return `<nav class="room-floating-nav" aria-label="Điều hướng trong phòng">${items.map(([action,icon,label])=>`<button type="button" data-action="${action}"><span>${icon}</span><small>${label}</small></button>`).join('')}<button type="button" class="room-nav-back" data-nav-back><span>🗺️</span><small>Bản đồ</small></button></nav>`;
}

const classSeatPositions=[
 [22,76],[41,76],[60,76],[79,76]
];

const classRanks=[
 {name:'Tân Binh IKIGAI',jp:'新人（しんじん）',desc:'Bắt đầu hành trình chinh phục tri thức',icon:'⚔️'},
 {name:'Học Giả Tập Sự',jp:'見習い学者',desc:'Đã bắt đầu tích lũy kiến thức',icon:'📖'},
 {name:'Nhà Thám Hiểm Tri Thức',jp:'知識の探検家',desc:'Không ngừng khám phá điều mới',icon:'🧭'},
 {name:'Chiến Binh Ngôn Ngữ',jp:'言語の戦士',desc:'Vững vàng trong các thử thách',icon:'🛡️'},
 {name:'Kiếm Sĩ Nhật Ngữ',jp:'日本語の剣士',desc:'Bắt đầu thể hiện bản lĩnh',icon:'⚔️'},
 {name:'Cao Thủ Nhật Ngữ',jp:'日本語の達人',desc:'Kiến thức và kỹ năng vượt trội',icon:'🔥'},
 {name:'Đại Sư Ngôn Ngữ',jp:'言語の大師',desc:'Làm chủ kiến thức và vận dụng linh hoạt',icon:'🌟'},
 {name:'Kiếm Thánh Nhật Ngữ',jp:'日本語の剣聖',desc:'Tinh thông, bản lĩnh và kiên định',icon:'⚡'},
 {name:'Thánh Giả IKIGAI',jp:'IKIGAIの聖者',desc:'Hình mẫu xuất sắc của học viện',icon:'👑'},
 {name:'Huyền Thoại IKIGAI',jp:'IKIGAIの伝説',desc:'Đỉnh cao danh vọng – biểu tượng của học viện',icon:'🏆',max:true}
];
function rankLevel(value){return Math.min(10,Math.max(1,Math.floor(Number(value||0)/100)+1))}
let lastSeenRankLevels=new Map(),rankCelebrationReady=false;
function showRankCelebration(player,level){
 const r=classRanks[level-1];if(!r)return;
 const host=$('classRankCelebration');if(!host)return;
 host.innerHTML=`<div class="rank-celebration-card rank-celebration-${level}"><div class="rank-celebration-icon">${r.icon}</div><small>LEVEL UP · IKIGAI WORLD</small><strong>${safe(player)}</strong><b>Lv.${level} · ${safe(r.name)}</b><span>${safe(r.jp)}</span><p>${safe(r.desc)}</p>${level===10?'<em>🏆 HALL OF FAME · MAX RANK</em>':''}</div><div class="rank-fireworks" aria-hidden="true">✨ 🎆 ✨ 🎇 ✨</div>`;
 host.hidden=false;host.classList.remove('show');void host.offsetWidth;host.classList.add('show');
 if(level===10)host.classList.add('max-rank');else host.classList.remove('max-rank');
 clearTimeout(window.__ikigaiRankCelebrationTimer);
 window.__ikigaiRankCelebrationTimer=setTimeout(()=>{host.classList.remove('show');host.hidden=true},6500);
}
function renderClassLeaderboard(){const host=$('classLeaderboard');if(host){host.innerHTML='';host.hidden=true;}}

function enterPlace(p){window.IKIGAI_AUDIO?.play(p);currentPlace=p;$('mapScene').hidden=true;$('roomScene').hidden=false;let title='',inside='';
const decor='<div class="wall"></div><div class="floor"></div><div class="window left"></div><div class="window right"></div>';
if(p==='class'){
 title='LỚP HỌC IKIGAI';
 inside=`<div class="classroom-gunny-scene" role="group" aria-label="Lớp học IKIGAI">
   <img class="classroom-gunny-art" src="assets/ikigai-classroom-redesign.png?v=10.0.0" alt="Phòng học IKIGAI với giáo viên nam, bảng lớn và một hàng bàn ghế" draggable="false">
   <section class="class-question-board" aria-live="polite" aria-label="Bảng nội dung bài học">
     <header class="board-heading">
       <span id="classBoardMode">BẢNG HỌC TẬP IKIGAI</span>
       <small id="classBoardCount">Chọn một chức năng bên phải</small>
     </header>
     <div id="classBoardQuestion">ようこそ！ Chọn Từ vựng, Ngữ pháp hoặc Kaiwa để bắt đầu.</div>
     <div id="classBoardOptions" aria-label="Các lựa chọn trả lời"></div>
     <div id="boardFeedback" class="board-feedback" aria-live="polite"></div>
     <footer id="classBoardFooter" class="board-footer" aria-live="polite"></footer>
   </section>
   <div id="classRankCelebration" class="class-rank-celebration" hidden aria-live="polite"></div>
   <nav class="classroom-function-menu" aria-label="Chức năng học tập">
     <button type="button" class="classroom-function-btn" data-action="vocabulary" aria-label="Từ vựng">Từ vựng</button>
     <button type="button" class="classroom-function-btn" data-action="grammar" aria-label="Ngữ pháp">Ngữ pháp</button>
     <button type="button" class="classroom-function-btn" data-action="kanji" aria-label="Kanji">Kanji</button>
     <button type="button" class="classroom-function-btn" data-action="kaiwa" aria-label="Kaiwa">Kaiwa</button>
     <button type="button" class="classroom-function-btn" data-action="listening" aria-label="Nghe hiểu">Nghe hiểu</button>
   </nav>
 </div>`;
}
if(p==='n5'){title='PHÒNG LUYỆN THI N5';inside=`${decor}<div class="exam-room-art n5-art"><div class="banner">🌸 N5 · KHU LUYỆN THI CƠ BẢN</div><div class="exam-window">富士山 · SAKURA</div><div class="exam-podium">N5<small>日本語能力試験</small></div><div class="exam-bookcase">📚 📚 📚<small>GIÁO TRÌNH N5</small></div><div class="exam-headphones">🎧<small>NGHE HIỂU</small></div><div class="exam-scroll">ひらがな · カタカナ · 漢字</div><div class="room-actors">${roomCharacter(roomPos,'me')}</div>${roomStations(['vocabulary','grammar','kanji','reading','listening','mock'])}`}
if(p==='n4'||p==='jft'){title=p==='n4'?'PHÒNG LUYỆN THI N4':'PHÒNG LUYỆN THI JFT';inside=`${decor}<div class="exam-room-art advanced-art"><div class="banner">${p==='n4'?'🏯 N4 · THỬ THÁCH TRUNG CẤP':'🎌 JFT-BASIC A2 · EXAM HALL'}</div><div class="exam-window">日本語 · CHALLENGE</div><div class="exam-podium">${p==='n4'?'N4':'A2'}<small>${p==='n4'?'日本語能力試験':'JFT-BASIC'}</small></div><div class="exam-bookcase">📚 📚 📚<small>THƯ VIỆN ĐỀ THI</small></div><div class="exam-headphones">🎧<small>LISTENING LAB</small></div><div class="exam-scroll">読む · 聞く · 書く · 話す</div><div class="room-actors">${roomCharacter(roomPos,'me')}</div>${roomStations(['vocabulary','grammar','kanji','reading','listening','mock'],true)}<div class="speech-room">Khu vực đang chờ ngân hàng đề riêng.</div>`}
if(p==='arena'){title='ĐẤU TRƯỜNG IKIGAI';inside=`${decor}<div class="arena-art"><div class="arena-banners">⚔️ IKIGAI BATTLE ARENA ⚔️</div><div class="arena-crowd">🏯　🏮　🏯　🏮　🏯</div><div class="arena-ring"><span>IKIGAI</span><small>知識の決闘</small></div><div class="arena-podium">🏆<small>HALL OF CHAMPIONS</small></div><div class="arena-weapon left">⚔️</div><div class="arena-weapon right">🛡️</div></div><div class="room-actors">${roomCharacter(roomPos,'me')}</div><div class="arena-lobby"><h3>⚔️ SẢNH CHỜ ĐẤU TRƯỜNG</h3><p>Chọn thể thức. Trận đấu chỉ bắt đầu khi đủ người và tất cả đã sẵn sàng.</p><div class="arena-modes"><button data-arena="1v1">⚔️ ĐẤU 1–1 <small>2 người</small></button><button data-arena="2v2">🛡️ ĐẤU 2–2 <small>4 người</small></button></div><div id="arenaStatus">Chưa tham gia hàng chờ.</div><div id="arenaRoster"></div><button id="arenaReady" class="gold" disabled>✓ SẴN SÀNG</button><button id="arenaCancel" class="secondary" disabled>RỜI HÀNG CHỜ</button></div>`}
if(p==='gym'){title='PHÒNG GYM IKIGAI';inside=`${decor}<div class="gym-room-art"><div class="gym-motto">鍛錬 · DISCIPLINE · PROGRESS</div><div class="gym-mirror"></div><div class="gym-rack"><span>🏋️</span><small>POWER RACK</small></div><div class="gym-bike">🚴<small>CARDIO</small></div><div class="gym-dumbbells">🏋️‍♀️<small>TẠ TAY</small></div><div class="gym-medals">🏅 🥇 🏆<small>BẢNG THÀNH TÍCH</small></div><div class="gym-coach">💪<small>HUẤN LUYỆN VIÊN</small><b>「無理せず、続けよう！」</b></div><div class="room-actors">${roomCharacter(roomPos,'me')}</div><div class="speech-room">Cùng rèn luyện thể lực, an toàn và vừa sức nhé!</div><button class="room-action" data-action="gym">🏆 BẮT ĐẦU THỬ THÁCH</button>`}
if(p==='tea'){title='PHÒNG GIÁM ĐỐC';inside=`${decor}<div class="tea-room-art"><div class="tea-window"><span>庭園 · 日本庭園</span></div><div class="tea-sign">茶道 · IKIGAI TEA HOUSE</div><div class="tea-shelf"><b>🍵</b><b>🫖</b><b>🏺</b><b>🍵</b><small>BỘ SƯU TẬP TRÀ</small></div><div class="tea-scroll">一期一会</div><div class="tea-host npc-tung" data-npc="tung"><div class="tung-head"><i class="tung-hair"></i><i class="tung-brow left"></i><i class="tung-brow right"></i><i class="tung-eye left"></i><i class="tung-eye right"></i><i class="tung-nose"></i><i class="tung-mouth"></i></div><div class="tung-body">👘</div><small>GIÁM ĐỐC · 店主</small><em>“Uống trà thì ngồi ngay ngắn.”</em></div><div class="tea-table"><span>急須</span><b>🍵</b><b>🍵</b><i>和菓子</i></div><div class="room-actors">${roomCharacter(roomPos,'me')}</div><div class="speech-room">“Uống trà với anh nhé.”</div><button class="room-action" data-action="tea">🍵 NGỒI UỐNG TRÀ</button>`}
$('roomScene').innerHTML=`<header class="room-top ${p==='class'?'room-top-class':''}">${p==='class'?'<div id="roomMusicSlot" class="room-music-slot"></div>':`<strong>${title}</strong>`}<div class="room-top-actions"><button id="roomChatToggle">💬 CHAT</button><button id="backMap">↩ VỀ BẢN ĐỒ</button></div></header><div class="interior interior-${p}">${inside}${p==='class'?'':`<div class="room-controls"><button data-dir="up">↑</button><button data-dir="left">←</button><button data-dir="down">↓</button><button data-dir="right">→</button></div>${roomFloatingNav(p)}`}</div>`;
if(p==='class')mountRoomMusicToggle();else restoreMusicToggle();
$('backMap').onclick=backMap;$('roomScene').querySelector('[data-nav-back]')?.addEventListener('click',backMap);$('roomChatToggle').onclick=()=>{$('chatbox').classList.toggle('open');$('chatInput').focus()};$('roomScene').querySelector('[data-npc="tung"]')?.addEventListener('click',()=>toast('Giám đốc: Ngồi xuống, cầm chén trà bằng hai tay nhé!'));
$('roomScene').querySelectorAll('.room-actor').forEach(el=>el.onclick=()=>{const id=el.dataset.id;if(id==='me')toast('Đây là nhân vật của bạn!');else{const p=people[id];if(p){if(channel&&joined)channel.send({type:'broadcast',event:'bubble',payload:{user_id:user.id,target:id,text:'Xin chào! Cùng học nhé!'}});toast('Đã gửi lời chào đến '+p.name)}}});$('roomScene').querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>roomAction(b.dataset.action));
$('roomScene').querySelectorAll('[data-arena]').forEach(b=>b.onclick=()=>joinArenaQueue(b.dataset.arena));
$('arenaReady')?.addEventListener('click',()=>setArenaReady(true));
$('arenaCancel')?.addEventListener('click',leaveArenaQueue);
$('roomScene').querySelectorAll('[data-dir]').forEach(b=>{b.onclick=()=>move(b.dataset.dir)});if(channel&&joined){channel.track(profile());channel.send({type:'broadcast',event:'scene',payload:{user_id:user.id,name:nickname,scene:'room',place:p}})}renderRoomPeers();if(currentPlace==='class'&&channel&&joined)channel.track(profile())}

function arenaPlayers(){
 if(!channel)return [];
 const state=channel.presenceState();
 return Object.values(state).flat().filter(p=>p.scene==='room'&&p.place==='arena'&&p.arenaMode);
}
async function publishArenaState(){
 if(!channel||!joined)return;
 await channel.track({...profile(),arenaMode,arenaReady});
 updateArenaLobby();
}
async function joinArenaQueue(mode){
 if(!['1v1','2v2'].includes(mode))return;
 arenaMode=mode;arenaReady=false;
 await publishArenaState();
 $('arenaReady').disabled=false;$('arenaCancel').disabled=false;
 $('arenaStatus').textContent=`Đã vào hàng chờ ${mode.toUpperCase()}. Nhấn SẴN SÀNG khi bạn đã sẵn sàng.`;
 updateArenaLobby();
}
async function setArenaReady(value){
 if(!arenaMode)return;
 arenaReady=!!value;await publishArenaState();updateArenaLobby();
}
async function leaveArenaQueue(){
 arenaMode='';arenaReady=false;
 if(channel&&joined)await channel.track(profile());
 $('arenaReady')?.setAttribute('disabled','');$('arenaCancel')?.setAttribute('disabled','');
 if($('arenaStatus'))$('arenaStatus').textContent='Bạn đã rời hàng chờ.';
 if($('arenaRoster'))$('arenaRoster').innerHTML='';
}
function updateArenaLobby(){
 const status=$('arenaStatus'),roster=$('arenaRoster');
 if(!status||!roster||!channel)return;
 if(!arenaMode){status.textContent='Chọn thể thức 1–1 hoặc 2–2 để tham gia.';return}
 const needed=arenaMode==='1v1'?2:4;
 const list=arenaPlayers().filter(p=>p.arenaMode===arenaMode).sort((a,b)=>String(a.user_id).localeCompare(String(b.user_id)));
 const mine=list.some(p=>p.user_id===user.id);
 const own={user_id:user.id,name:nickname,arenaReady,arenaMode};
 if(!mine)list.push(own);
 const rosterList=list.slice(0,needed);
 roster.innerHTML=rosterList.map(p=>`<div class="arena-player ${p.arenaReady?'ready':''}"><span>${safe(p.name||'Học viên')}</span><b>${p.arenaReady?'✓ Sẵn sàng':'Đang chờ'}</b></div>`).join('');
 status.textContent=`${Math.min(list.length,needed)}/${needed} người · ${arenaReady?'Bạn đã sẵn sàng':'Bạn chưa sẵn sàng'}`;
 if(list.length>=needed&&rosterList.length===needed&&rosterList.every(p=>p.arenaReady)&&rosterList.some(p=>p.user_id===user.id)){
  if(!$('arenaBattle'))$('roomScene').insertAdjacentHTML('beforeend',`<div class="arena-battle-modal" id="arenaBattle"><div><small>IKIGAI WORLD · MATCH FOUND</small><h2>⚔️ ĐÃ GHÉP ĐỦ ĐỘI!</h2><p>${arenaMode.toUpperCase()} · ${rosterList.map(p=>safe(p.name)).join(' vs ')}</p><p>Trận đấu kiến thức đã sẵn sàng. Mọi người có thể bắt đầu lượt thi.</p><button class="gold" id="startArenaQuiz">BẮT ĐẦU THỬ THÁCH</button><button class="secondary" id="closeArenaBattle">ĐÓNG</button></div></div>`);
  $('startArenaQuiz')?.addEventListener('click',()=>{ $('arenaBattle')?.remove();startQuiz('duel')});
  $('closeArenaBattle')?.addEventListener('click',()=>{$('arenaBattle')?.remove();leaveArenaQueue()});
 }
}
function renderRoomPeers(){if(currentPlace==='class')return;const host=$('roomScene').querySelector('.room-actors');if(!host)return;host.querySelectorAll('.room-actor[data-peer="true"]').forEach(el=>el.remove());Object.values(people).filter(p=>p.scene==='room'&&p.place===currentPlace&&p.user_id!==user.id).forEach(p=>host.insertAdjacentHTML('beforeend',roomCharacter({x:p.roomX??50,y:p.roomY??70},p.user_id||p.id,p.name,p.role,p.gender,p.avatar)))}
function backMap(){restoreMusicToggle();window.IKIGAI_AUDIO?.play('map');if(arenaMode)leaveArenaQueue();$('roomScene').hidden=true;$('mapScene').hidden=false;if(channel&&joined){channel.track(profile());channel.send({type:'broadcast',event:'scene',payload:{user_id:user.id,name:nickname,scene:'map',place:'map'}})}renderActors()}
async function loadBank(){try{const r=await fetch('assets/ikigai-n5-bank.json');if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();bank=d.questions||[];toast(`Đã nạp ngân hàng N5: ${bank.length} câu`)}catch(e){console.error(e);toast('Không tải được ngân hàng câu hỏi N5')}}

const kaiwaStarter=[
{lesson:1,question:'Aさん：おはようございます。 Bさん：＿＿＿。',options:['おはようございます','さようなら','いただきます','おやすみなさい'],correct:'A',explanation:'Buổi sáng, đáp lại おはようございます bằng おはようございます。'},
{lesson:1,question:'Aさん：はじめまして。 Bさん：＿＿＿。',options:['お元気ですか','はじめまして','おやすみなさい','どういたしまして'],correct:'B',explanation:'Lần đầu gặp nhau, đáp lại はじめまして。'},
{lesson:2,question:'Aさん：これは何ですか。 Bさん：＿＿＿。',options:['私です','先生です','本です','日本です'],correct:'C',explanation:'これは何ですか hỏi “Đây là cái gì?”.'},
{lesson:2,question:'Aさん：それはあなたの本ですか。 Bさん：はい、＿＿＿。',options:['そうです','違います','何ですか','どこですか'],correct:'A',explanation:'はい、そうです là cách xác nhận tự nhiên.'},
{lesson:3,question:'Aさん：トイレはどこですか。 Bさん：＿＿＿。',options:['三時です','あそこです','千円です','学生です'],correct:'B',explanation:'どこ hỏi vị trí; あそこです nghĩa là ở đằng kia.'},
{lesson:3,question:'Aさん：学校はどちらですか。 Bさん：＿＿＿。',options:['九時です','これです','こちらです','だれです'],correct:'C',explanation:'こちらです là cách chỉ hướng/vị trí lịch sự.'},
{lesson:4,question:'Aさん：今、何時ですか。 Bさん：＿＿＿。',options:['月曜日です','七時です','学校です','一人です'],correct:'B',explanation:'何時 hỏi mấy giờ; 七時です là bảy giờ.'},
{lesson:4,question:'Aさん：毎朝、何時に起きますか。 Bさん：＿＿＿。',options:['六時に起きます','六時を食べます','六時へ行きます','六時がいます'],correct:'A',explanation:'何時に起きますか hỏi thời điểm thức dậy.'},
{lesson:5,question:'Aさん：明日、どこへ行きますか。 Bさん：＿＿＿。',options:['友達と映画館へ行きます','昨日行きました','九時からです','学生ではありません'],correct:'A',explanation:'どこへ行きますか hỏi địa điểm; trả lời nơi sẽ đến.'},
{lesson:5,question:'Aさん：いっしょに昼ご飯を食べませんか。 Bさん：＿＿＿。',options:['いいですね','いただきますでした','どなたですか','何階ですか'],correct:'A',explanation:'Lời mời 食べませんか có thể đáp lại いいですね。'}
];

function setClassBoard(mode,count,question,optionsHTML=''){
 const title=$('classBoardMode'),counter=$('classBoardCount'),prompt=$('classBoardQuestion'),opts=$('classBoardOptions');
 if(title)title.textContent=mode;
 if(counter)counter.textContent=count;
 if(prompt)prompt.textContent=question;
 if(opts)opts.innerHTML=optionsHTML;
 const feedback=$('boardFeedback');if(feedback){feedback.textContent='';feedback.className='board-feedback';}
 const footer=$('classBoardFooter');if(footer)footer.innerHTML='';
 const activity=$('activity');if(activity)activity.hidden=true;
}
function openLessonPicker(group){
 activeGroup=group;
 const label=group==='vocabulary'?'TỪ VỰNG':group==='grammar'?'NGỮ PHÁP':'KAIWA';
 setClassBoard(label+' · TỰ HỌC CÁ NHÂN','CHỌN BÀI 1–25','Chọn bài Minna no Nihongo bạn muốn luyện tập.',
 Array.from({length:25},(_,i)=>`<button class="board-choice lesson-choice" data-lesson="${i+1}">Bài ${i+1}</button>`).join(''));
 const lessonOptions=$('classBoardOptions');
 if(lessonOptions)lessonOptions.scrollTop=0;
 lessonOptions?.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>startLessonGame(group,Number(b.dataset.lesson)));
}
function startLessonGame(group,lesson){
 activeGroup=group;
 const source=group==='kaiwa'?kaiwaStarter.filter(q=>q.lesson===lesson):bank.filter(q=>q.group===group&&Number(q.lesson)===lesson);
 qset=shuffle(source).slice(0,group==='kaiwa'?source.length:10);
 if(!qset.length){
  setClassBoard('CHƯA CÓ DỮ LIỆU','BÀI '+lesson,'Chưa có câu hỏi cho bài này.',
   '<button class="board-choice" id="backToLessons">CHỌN BÀI KHÁC</button>');
  $('backToLessons')?.addEventListener('click',()=>openLessonPicker(group));return;
 }
 qpos=0;score=0;renderClassGame(lesson);
}
function renderClassGame(lesson){
 const q=qset[qpos],correct='ABCD'.indexOf(q.correct),kind=activeGroup==='vocabulary'?'TỪ VỰNG':activeGroup==='grammar'?'NGỮ PHÁP':'KAIWA';
 const fruits=['🍉','🍊','🍓','🍍'];
 setClassBoard(kind+' · BÀI '+lesson,'CÂU '+(qpos+1)+' / '+qset.length+' · BÀI CÁ NHÂN',q.question,
 q.options.map((o,i)=>`<button class="board-choice board-answer" data-opt="${i}"><span class="board-answer-icon">${activeGroup==='vocabulary'?fruits[i]:'ABCD'[i]}</span><b>${'ABCD'[i]}.</b> ${safe(o)}</button>`).join(''));
 const opts=$('classBoardOptions');
 opts?.querySelectorAll('[data-opt]').forEach(b=>b.onclick=()=>{
  if(opts.querySelector('[data-opt]:disabled'))return;
  opts.querySelectorAll('[data-opt]').forEach(x=>x.disabled=true);
  const ok=Number(b.dataset.opt)===correct;
  if(ok){score++;b.classList.add('is-correct')}else{b.classList.add('is-wrong');opts.querySelector(`[data-opt="${correct}"]`)?.classList.add('is-correct')}
  const feedback=$('boardFeedback');
  if(feedback){feedback.textContent=ok?'✨ Chính xác! +1 điểm':'Chưa chính xác. Đáp án đúng: '+q.options[correct];feedback.className='board-feedback '+(ok?'good':'bad')}
  const next=document.createElement('button');next.className='board-choice board-next';next.textContent=qpos===qset.length-1?'XEM KẾT QUẢ':'CÂU TIẾP THEO';
  next.onclick=()=>{qpos++;qpos<qset.length?renderClassGame(lesson):finishClassBoard()};
  const footer=$('classBoardFooter');
  if(footer)footer.replaceChildren(next);else opts.appendChild(next);
 });
}
async function finishClassBoard(){
 window.IKIGAI_AUDIO?.success();
 const earned=score*10,synced=await persistAward();
 const result=role==='guest'?'Bạn đang chơi chế độ khách; điểm không được lưu.':role==='teacher'?'Tài khoản giáo viên không nhận XP học viên.':synced?`Đã cộng ${earned} XP và đồng bộ vào tài khoản.`:'Chưa cộng thưởng do chưa đồng bộ được dữ liệu.';
 setClassBoard('HOÀN THÀNH THỬ THÁCH','KẾT QUẢ CÁ NHÂN',`🏆 ${score}/${qset.length} câu đúng`,
 `<p class="board-result-note">${safe(result)}</p><button class="board-choice" id="againBoard">LUYỆN LẠI</button><button class="board-choice" id="doneBoard">CHỌN NỘI DUNG KHÁC</button>`);
 $('againBoard')?.addEventListener('click',()=>openLessonPicker(activeGroup));
 $('doneBoard')?.addEventListener('click',()=>setClassBoard('BẢNG HỌC TẬP IKIGAI','TỰ HỌC CÁ NHÂN','Chọn một chức năng bên phải để bắt đầu.',''));
}
function roomAction(a){
 if(a==='vocabulary'||a==='grammar'||a==='kaiwa'){openLessonPicker(a);return}
 if(a==='kanji'){setClassBoard('KANJI · SẮP RA MẮT','CHỨC NĂNG ĐANG PHÁT TRIỂN','Nội dung luyện tập Kanji sẽ được bổ sung trong bản cập nhật tiếp theo.','');return}
 if(a==='listening'){setClassBoard('NGHE HIỂU · SẮP RA MẮT','CHỨC NĂNG ĐANG PHÁT TRIỂN','Ngân hàng âm thanh và bài nghe sẽ được bổ sung trong bản cập nhật tiếp theo.','');return}
 if(['reading','mock','duel'].includes(a)){if(!bank.length){toast('Ngân hàng câu hỏi chưa tải xong');return}startQuiz(a);return}
 if(a==='rules'){info('Luật đấu tập','Mỗi câu trả lời đúng được 10 XP. Hiện tại là đấu tập cục bộ, chưa phải ghép trận trực tuyến.');return}
 if(a==='gym'){info('Thử thách Gym','Chọn một hoạt động an toàn: đi bộ tại chỗ 1 phút, vươn vai 10 lần hoặc hít thở và giãn cơ. Không cố quá sức.');return}
 if(a==='tea'){info('Anh Tùng','“Uống trà với anh nhé”. Nghỉ ngơi một chút rồi tiếp tục hành trình học tập nhé.');return}
}

function info(title,txt){const a=$('activity');a.hidden=false;a.innerHTML=`<button class="close-activity">×</button><small>IKIGAI WORLD</small><h2>${title}</h2><p>${txt}</p><button class="gold" id="infoOk">ĐÃ HIỂU</button>`;a.querySelector('.close-activity').onclick=()=>a.hidden=true;$('infoOk').onclick=()=>a.hidden=true}
function shuffle(a){const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
function startQuiz(group){activeGroup=group;let rows=group==='mock'||group==='duel'?bank.filter(q=>['vocabulary','grammar','kanji'].includes(q.group)):bank.filter(q=>q.group===group);qset=shuffle(rows).slice(0,group==='mock'||group==='duel'?20:10);if(!qset.length){info('Chưa có dữ liệu',`Chưa có câu hỏi cho mục ${group}.`);return}qpos=0;score=0;renderQuestion()}
function renderQuestion(){const q=qset[qpos],correct='ABCD'.indexOf(q.correct),a=$('activity');a.hidden=false;a.innerHTML=`<button class="close-activity">×</button><small>NGÂN HÀNG IKIGAI N5 · ${safe(q.id)} · CÂU ${qpos+1}/${qset.length}</small><h2>${activeGroup==='duel'?'ĐẤU TẬP KIẾN THỨC':activeGroup==='mock'?'THI THỬ TỔNG HỢP N5':'LUYỆN TẬP IKIGAI'}</h2><div class="progress"><i style="width:${qpos/qset.length*100}%"></i></div><div class="question">${safe(q.question)}</div><div class="answers">${q.options.map((o,i)=>`<button data-opt="${i}">${'ABCD'[i]}. ${safe(o)}</button>`).join('')}</div><div class="feedback" id="feedback"></div><small class="muted">Điểm: ${score} · Mã câu: ${safe(q.id)}</small>`;a.querySelector('.close-activity').onclick=()=>a.hidden=true;a.querySelectorAll('[data-opt]').forEach(b=>b.onclick=()=>{a.querySelectorAll('[data-opt]').forEach(x=>x.disabled=true);const ok=Number(b.dataset.opt)===correct;if(ok){score++;$('feedback').textContent='🎉 Chính xác!';$('feedback').style.color='#287443'}else{$('feedback').textContent='Chưa chính xác. Đáp án: '+q.correct;$('feedback').style.color='#b34836'}if(q.explanation){const p=document.createElement('p');p.className='muted';p.textContent=q.explanation;$('feedback').after(p)}const n=document.createElement('button');n.className='gold';n.textContent=qpos===qset.length-1?'XEM KẾT QUẢ':'CÂU TIẾP THEO';n.onclick=()=>{qpos++;qpos<qset.length?renderQuestion():finishQuiz()};a.appendChild(n)})}
async function finishQuiz(){const earned=score*10;const synced=await persistAward();const a=$('activity');a.innerHTML=`<button class="close-activity">×</button><small>IKIGAI WORLD · KẾT QUẢ</small><h2>Hoàn thành thử thách!</h2><div class="question">🏆 ${score}/${qset.length} câu đúng</div><p>${role==='guest'?'Bạn đang chơi chế độ khách; điểm không được lưu.':role==='teacher'?'Tài khoản giáo viên không nhận XP học viên.':synced?`Đã cộng ${earned} XP và đồng bộ vào tài khoản.`:'Chưa cộng thưởng do chưa đồng bộ được dữ liệu.'}</p><button class="gold" id="again">LUYỆN LẠI</button> <button class="secondary" id="done">QUAY LẠI PHÒNG</button>`;a.querySelector('.close-activity').onclick=()=>a.hidden=true;$('again').onclick=()=>startQuiz(activeGroup);$('done').onclick=()=>a.hidden=true}
document.querySelectorAll('[data-menu]').forEach(b=>b.onclick=()=>toast(`${b.dataset.menu}: khu chức năng đang được hoàn thiện.`));
document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>{
 const key=b.dataset.quick;
 if(key==='Bạn bè'){$('memberbox').classList.add('open');return}
 if(key==='Học tập'){backMap();enterPlace('class');return}
 if(key==='Bài thi'){backMap();enterPlace('n5');return}
 toast(`${key}: sẽ mở khi chức năng được kết nối.`);
});
$('logoutBtn').onclick=async()=>{if(client)await client.auth.signOut();if(channel)await client.removeChannel(channel);location.reload()};
window.addEventListener('beforeunload',()=>{if(client&&channel)client.removeChannel(channel)});
save();updateAvatar();
})();