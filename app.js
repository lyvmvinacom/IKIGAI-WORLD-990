(()=>{'use strict';
// IKIGAI WORLD 9.1 — commercial-style overworld art integration

const SUPABASE_URL='https://vfimwlijbxamudirejiq.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_IETjbMWeJthqXscH9fkrXg_x2QZiL8D';
const ROOM='ikigai-world-main';
const $=id=>document.getElementById(id),safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Prefer the browser's native landscape lock when the host has entered fullscreen.
// CSS keeps the complete app landscape if the browser does not support locking.
async function syncLandscapeLock(){
 try{if(document.fullscreenElement && screen.orientation?.lock) await screen.orientation.lock('landscape')}catch(_){/* CSS landscape canvas is the fallback. */}
}
document.addEventListener('fullscreenchange',syncLandscapeLock);
const musicToggleNode=$('musicToggle');
const musicToggleHome=document.createComment('IKIGAI music toggle home');
if(musicToggleNode?.parentNode)musicToggleNode.parentNode.insertBefore(musicToggleHome,musicToggleNode);
function mountRoomMusicToggle(){const slot=$('roomMusicSlot');if(slot&&musicToggleNode)slot.appendChild(musicToggleNode);}
function restoreMusicToggle(){if(musicToggleNode&&musicToggleHome.parentNode)musicToggleHome.parentNode.insertBefore(musicToggleNode,musicToggleHome.nextSibling);}

let characterHair=0,characterFace=0,characterLocked=false;
let client=null,channel=null,user=null,nickname='',role='student',gender='male',avatar=0,joined=false,bank=[],currentPlace='',qset=[],qpos=0,score=0,activeGroup='',myPos={x:50,y:70},roomPos={x:50,y:70},people={},moving=false,lastSend=0,moveLoop=null,keys={},xp=0,coins=0,profileLoaded=false,awardBusy=false,arenaMode='',arenaReady=false,arenaTimer=null,arenaMatch=null,arenaMatchTick=null,arenaMatchResults={},arenaMatchAnswers={},arenaMatchFinalized=false;
const stateKey='ikigaiWorld3Player';
const placeData={class:['Lớp học IKIGAI','Nơi học từ vựng, ngữ pháp và Kanji cùng リー先生.'],arena:['Đấu trường IKIGAI','Đấu tập kiến thức N5 với bạn bè.'],n4:['Phòng luyện thi N4','Khu vực đã sẵn sàng; ngân hàng N4 sẽ được kết nối khi có dữ liệu.'],n5:['Phòng luyện thi N5','Ôn tập từ vựng, ngữ pháp, Kanji, đọc hiểu và nghe hiểu.'],jft:['Phòng luyện thi JFT','Khu vực JFT-Basic A2. Đề thi sẽ được kết nối theo bộ dữ liệu JFT riêng.'],gym:['Phòng Gym','Gặp huấn luyện viên và hoàn thành thử thách vận động an toàn.'],tea:['Phòng Trà IKIGAI','Không gian thưởng trà và giao lưu của IKIGAI. “Uống trà với anh nhé”.']};
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>$('toast').classList.remove('show'),2600)}
function save(){ $('xp').textContent=String(xp);$('coins').textContent=String(coins);$('level').textContent=String(Math.floor(xp/100)+1);$('progressSource').textContent=profileLoaded?'Đồng bộ tài khoản':'Chưa đồng bộ'; }
function asset(g,a,h=0,f=0){return `assets/characters/gunny_${g==='female'?'f':'m'}_${Math.max(0,Math.min(4,Number(a)||0))}.png`}
function characterImage(g=gender,a=avatar,h=characterHair,f=characterFace){
 return asset(g,a,h,f);
}
function updateCharacterBuilder(){
 const preview=$('avatarPreview');if(preview)preview.src=asset(gender,avatar,characterHair,characterFace);
 const grid=$('characterOptions');if(grid)grid.innerHTML=Array.from({length:5},(_,i)=>`<button type="button" data-character="${i}" class="${i===avatar?'selected':''}"><img src="${asset(gender,i,characterHair,characterFace)}" alt="Mẫu ${i+1}"><small>Mẫu ${i+1}</small></button>`).join('');
 grid?.querySelectorAll('[data-character]').forEach(b=>b.onclick=()=>{if(characterLocked)return;avatar=Number(b.dataset.character);updateCharacterBuilder()});
 const hair=$('characterHair'),face=$('characterFace');
 if(hair){hair.value='0';hair.disabled=true}if(face){face.value='0';face.disabled=true}
 const note=$('characterLockNote');if(note)note.textContent=characterLocked?'🔒 Nhân vật đã được lưu, không thể thay đổi.':'⚠️ Chỉ được tạo nhân vật một lần. Sau khi xác nhận sẽ khóa vĩnh viễn.';
}

function avatarMarkup(p,isMe=false){const img=p.role==='teacher'?asset('male',0,0,0):asset(p.gender||'male',p.avatar||0,p.hair||0,p.face||0);return `<div class="actor ${isMe?'me':''} ${p.role==='teacher'?'teacher':''}" data-id="${safe(p.id)}" style="left:${p.x??50}%;top:${p.y??70}%" data-direction="${safe(p.direction||'down')}"><div class="speech"></div><img src="${img}" alt=""><div class="name">${safe(p.name||'Học viên')}</div></div>`}
function setLoginTab(tab){document.querySelectorAll('.login-tabs button').forEach(b=>b.classList.toggle('selected',b.dataset.tab===tab));$('studentForm').hidden=tab!=='student';$('teacherForm').hidden=tab!=='teacher'}
document.querySelectorAll('.login-tabs button').forEach(b=>b.onclick=()=>setLoginTab(b.dataset.tab));
document.querySelectorAll('[data-gender]').forEach(b=>b.onclick=()=>{gender=b.dataset.gender;document.querySelectorAll('[data-gender]').forEach(x=>x.classList.toggle('selected',x===b));updateAvatar()});
function updateAvatar(){updateCharacterBuilder()}
$('avatarPrev').onclick=()=>{avatar=(avatar+1)%5;updateAvatar()};$('avatarNext').onclick=()=>{avatar=(avatar+1)%5;updateAvatar()};
$('characterHair')?.addEventListener('change',e=>{if(!characterLocked){characterHair=0;updateCharacterBuilder()}});
$('characterFace')?.addEventListener('change',e=>{if(!characterLocked){characterFace=0;updateCharacterBuilder()}});
updateCharacterBuilder();
function setup(){if(!window.supabase){$('loginStatus').textContent='Không tải được thư viện kết nối. Hãy kiểm tra Internet.';return false}client=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);return true}
async function studentAuth(signup){const email=$('studentEmail').value.trim(),password=$('studentPassword').value;nickname=$('studentName').value.trim();if((signup&&!nickname)||!email||password.length<6){$('loginStatus').textContent='Nhập tên, email và mật khẩu từ 6 ký tự trở lên.';return}if(!setup())return;setBusy(true);try{if(signup){const {data,error}=await client.auth.signUp({email,password,options:{data:{nickname,role:'student',gender,avatar,hair:characterHair,face:characterFace}}});if(error)throw error;if(!data.session){$('loginStatus').textContent='Tài khoản đã tạo. Hãy xác nhận email nếu Supabase yêu cầu, sau đó đăng nhập.';setBusy(false);return}user=data.user}else{const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;user=data.user;nickname=user.user_metadata?.nickname||nickname||email.split('@')[0];gender=user.user_metadata?.gender||gender;avatar=Number(user.user_metadata?.avatar||0);characterHair=Number(user.user_metadata?.hair||0);characterFace=Number(user.user_metadata?.face||0)}role='student';await enterWorld()}catch(e){$('loginStatus').textContent=translateError(e.message);setBusy(false)}}
function translateError(s){if(/Invalid login credentials/i.test(s))return 'Email hoặc mật khẩu chưa đúng.';if(/already registered/i.test(s))return 'Email này đã có tài khoản. Hãy chọn Đăng nhập.';if(/Email not confirmed/i.test(s))return 'Email chưa được xác nhận. Hãy kiểm tra hộp thư.';return s}
function setBusy(v){$('studentSignIn').disabled=v;$('studentSignUp').disabled=v;$('teacherSignIn').disabled=v;$('guestEnter').disabled=v}
async function teacherAuth(){const email=$('teacherEmail').value.trim(),password=$('teacherPassword').value;if(!email||!password){$('loginStatus').textContent='Nhập email và mật khẩu giáo viên.';return}if(!setup())return;setBusy(true);try{const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;if(data.user.app_metadata?.role!=='teacher'){await client.auth.signOut();throw new Error('Tài khoản chưa được cấp quyền teacher trong Supabase.')}user=data.user;role='teacher';nickname='リー先生';gender='male';avatar=0;await enterWorld()}catch(e){$('loginStatus').textContent=translateError(e.message);setBusy(false)}}
async function guest(){nickname=$('studentName').value.trim()||'Khách IKIGAI';if(!setup())return;setBusy(true);try{const {data,error}=await client.auth.signInAnonymously();if(error)throw error;user=data.user;role='guest';await enterWorld()}catch(e){$('loginStatus').textContent='Không vào được chế độ khách: '+e.message;setBusy(false)}}
$('studentSignIn').onclick=()=>studentAuth(false);$('studentSignUp').onclick=()=>studentAuth(true);$('teacherSignIn').onclick=teacherAuth;$('guestEnter').onclick=guest;
async function enterWorld(){if(!user)throw Error('Chưa xác thực tài khoản');$('login').hidden=true;$('openQuestionManager').hidden=role!=='teacher';window.IKIGAI_AUDIO?.play('map');$('hudName').textContent=nickname;$('hudRole').textContent=role==='teacher'?'GIÁO VIÊN · リー先生':role==='guest'?'KHÁCH · PHIÊN TẠM':'HỌC VIÊN IKIGAI';$('hudAvatar').textContent=role==='teacher'?'👨🏻‍🏫':'🌸';await loadPlayerProfile();save();await connectRealtime();await loadBank();renderActors();toast('🌸 Chào mừng '+nickname+' đến IKIGAI WORLD!')}
async function connectRealtime(){if(channel){try{await client.removeChannel(channel)}catch(e){}}joined=false;channel=client.channel(ROOM,{config:{presence:{key:user.id},broadcast:{self:false}}});
channel.on('presence',{event:'sync'},()=>{const state=channel.presenceState();people={};Object.values(state).flat().forEach(p=>{if(p.user_id!==user.id)people[p.user_id]=p});renderActors();renderMembers();if(!$('roomScene').hidden){renderRoomPeers();}updateArenaLobby()});
channel.on('broadcast',{event:'position'},({payload})=>{if(!payload||payload.user_id===user.id)return;const p=people[payload.user_id]||{};Object.assign(p,payload);people[payload.user_id]=p;updateActor(payload);renderMembers()});
channel.on('broadcast',{event:'chat'},({payload})=>{if(payload?.user_id!==user.id){const scene=$('roomScene').hidden?'map':'room';if(payload?.scene===scene&&(scene!=='room'||payload?.place===currentPlace)){addMessage(payload.name,payload.text,payload.role==='teacher');if(scene==='room')showBubble(payload.user_id,payload.text)}}});
channel.on('broadcast',{event:'bubble'},({payload})=>{if(payload?.user_id!==user.id)showBubble(payload.user_id,payload.text)});
channel.on('broadcast',{event:'arena-match'},({payload})=>handleArenaMatchEvent(payload));
channel.on('broadcast',{event:'scene'},({payload})=>{if(payload?.user_id!==user.id&&payload?.scene==='room')toast(`${payload.name} đã vào ${placeData[payload.place]?.[0]||'một phòng'}`)});
const status=await new Promise(resolve=>{const timer=setTimeout(()=>resolve('TIMEOUT'),10000);channel.subscribe(async s=>{if(s==='SUBSCRIBED'){clearTimeout(timer);joined=true;await channel.track(profile());$('connectionStatus')?.classList.add('connected');resolve(s)}else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'){clearTimeout(timer);resolve(s)}})});
if(status!=='SUBSCRIBED')toast('Chưa kết nối được máy chủ nhiều người chơi. Bạn vẫn có thể học cục bộ.');}
function profile(){return {user_id:user.id,id:user.id,name:nickname,role:role==='teacher'?'teacher':role==='guest'?'guest':'student',gender,avatar,hair:characterHair,face:characterFace,x:myPos.x,y:myPos.y,moving:!!myPos.moving,direction:myPos.direction||'down',scene:$('roomScene').hidden?'map':'room',place:currentPlace||'map',roomX:roomPos.x,roomY:roomPos.y,xp:Number(xp||0),level:Math.floor(Number(xp||0)/100)+1,online_at:new Date().toISOString()}}
async function loadPlayerProfile(){xp=0;coins=0;profileLoaded=false;if(role==='guest'){save();return}try{const {data,error}=await client.rpc('ikigai_ensure_profile',{p_nickname:nickname,p_gender:gender,p_avatar:avatar,p_hair:characterHair,p_face:characterFace});if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(row){nickname=row.nickname||nickname;gender=row.gender||gender;avatar=Number(row.avatar||0);characterHair=Number(row.hair||0);characterFace=Number(row.face||0);characterLocked=!!row.character_locked;updateCharacterBuilder();xp=Number(row.xp||0);coins=Number(row.coins||0)}profileLoaded=true;$('hudName').textContent=nickname;save()}catch(e){console.error('Profile sync:',e);toast('Chưa đồng bộ được hồ sơ/XP. Hãy kiểm tra migration Supabase IKIGAI 10.5.7.');save()}}
async function persistAward(){if(role==='guest'||!profileLoaded||awardBusy)return false;awardBusy=true;try{const {data,error}=await client.rpc('ikigai_award_quiz',{p_xp:score*10,p_coins:Math.max(0,Math.floor(score*2)),p_correct:score,p_total:qset.length,p_attempt_id:crypto.randomUUID()});if(error)throw error;xp=Number(data?.xp??xp);coins=Number(data?.coins??coins);save();if(channel&&joined)await channel.track(profile());if(currentPlace==='class')renderClassLeaderboard();return true}catch(e){console.error('Award sync:',e);toast('Kết quả đã chấm nhưng chưa cộng thưởng lên tài khoản. Cần kiểm tra RPC Supabase.');return false}finally{awardBusy=false}}
function renderActors(){/* Gunny-style: map is scenery only; sprites appear after entering a room. */$('mapActors').innerHTML='';$('onlineCount').textContent=String(Object.keys(people).length+1)}
function bindActorClicks(){document.querySelectorAll('.actor').forEach(el=>el.onclick=()=>{const id=el.dataset.id;if(id===user.id){toast('Đây là nhân vật của bạn.');return}const p=people[id];if(p){showBubble(id,'こんにちは '+nickname+'! 一緒に勉強しよう！');sendBubble(id,'こんにちは! 👋')}})}
function updateActor(p){const el=document.querySelector(`.actor[data-id="${CSS.escape(p.user_id)}"]`);if(el){el.style.left=p.x+'%';el.style.top=p.y+'%';el.classList.toggle('walking',!!p.moving);if(p.direction)el.dataset.direction=p.direction;if(p.gender||p.avatar!==undefined){const img=el.querySelector('img');img.src=p.role==='teacher'?asset('male',0,0,0):asset(p.gender,p.avatar,p.hair||0,p.face||0)}}const re=$('roomScene').querySelector(`.room-actor[data-id="${CSS.escape(p.user_id)}"]`);if(re){re.style.left=(p.roomX||50)+'%';re.style.top=(p.roomY||70)+'%'}else if(!$('roomScene').hidden&&p.scene==='room'&&p.place===currentPlace){if(currentPlace==='arena'){const peer=$('arenaPeerStage')?.querySelector(`.arena-live-player[data-player-id="${CSS.escape(p.user_id)}"]`);if(peer){peer.style.left=(p.roomX??50)+'%';peer.style.top=(p.roomY??72)+'%';peer.classList.toggle('walking',!!p.moving);if(p.direction)peer.dataset.direction=p.direction}else renderArenaLobbyPeers()}else renderRoomPeers()}if(!el&&$('roomScene').hidden)renderActors()}
function renderMembers(){const arr=[{user_id:user.id,name:nickname,role,gender,avatar},...Object.values(people)];$('members').innerHTML=arr.map(p=>`<div class="member-row"><img src="${p.role==='teacher'?asset('male',0,0,0):asset(p.gender,p.avatar||0,p.hair||0,p.face||0)}"><span><b>${safe(p.name)}</b><br><small>${p.role==='teacher'?'Giáo viên':'Học viên'}</small></span></div>`).join('')}
function addMessage(name,text,teacher=false){const d=document.createElement('div');d.className='message';d.innerHTML=`<b>${safe(name)}</b><small>${new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</small><br>${safe(text)}`;$('messages').appendChild(d);$('messages').scrollTop=$('messages').scrollHeight}
function sendChat(text){text=text.trim();if(!text)return;addMessage(nickname,text,role==='teacher');if(!$('roomScene').hidden)showBubble('me',text);if(channel&&joined)channel.send({type:'broadcast',event:'chat',payload:{user_id:user.id,name:nickname,text,role,scene:$('roomScene').hidden?'map':'room',place:currentPlace||'map'}})}
$('chatForm').onsubmit=e=>{e.preventDefault();sendChat($('chatInput').value);$('chatInput').value='';$('chatInput').blur()};

$('chatToggle').onclick=()=>$('chatbox').classList.toggle('open');$('closeChat').onclick=()=>$('chatbox').classList.remove('open');$('closeMembers').onclick=()=>$('memberbox').classList.remove('open');
function showBubble(id,text){const root=$('roomScene').hidden?document:$('roomScene');const actor=(currentPlace==='arena'&&!$('roomScene').hidden) ? (id==='me' ? root.querySelector('.arena-live-player.arena-self') : root.querySelector(`.arena-live-player[data-player-id="${CSS.escape(id)}"]`)) : root.querySelector(`.room-actor[data-id="${CSS.escape(id)}"], .actor[data-id="${CSS.escape(id)}"]`);if(!actor)return;let el=actor.querySelector('.speech');if(!el){el=document.createElement('div');el.className='speech';actor.prepend(el)}el.textContent=String(text||'').slice(0,120);el.classList.add('show');clearTimeout(el._bubbleTimer);el._bubbleTimer=setTimeout(()=>el.classList.remove('show'),5000)}
function sendBubble(id,text){if(channel&&joined)channel.send({type:'broadcast',event:'bubble',payload:{user_id:user.id,target:id,text}})}
const dirs={up:[0,-.8],down:[0,.8],left:[-.8,0],right:[.8,0]};
function moveArenaVector(dx,dy,intensity=1){
 const length=Math.hypot(dx,dy);if(!length)return;
 const nx=dx/length,ny=dy/length,step=.95*Math.max(.35,Math.min(1,intensity));
 // Elliptical arena floor: character feet remain inside the visible combat platform.
 const cx=48,cy=66,rx=25,ry=15;
 let px=Number(roomPos.x)||cx,py=Number(roomPos.y)||cy;
 if(((px-cx)/rx)**2+((py-cy)/ry)**2>1){px=cx;py=cy}
 let tx=px+nx*step*.65,ty=py+ny*step*.42;
 const r=Math.hypot((tx-cx)/rx,(ty-cy)/ry);
 if(r>0.94){tx=cx+(tx-cx)*.94/r;ty=cy+(ty-cy)*.94/r}
 roomPos.x=tx;roomPos.y=ty;
 const angle=Math.atan2(ny,nx)*180/Math.PI;
 myPos.direction=(angle>=-45&&angle<45)?'right':(angle>=45&&angle<135)?'down':(angle>=-135&&angle<-45)?'up':'left';myPos.moving=true;
 const el=$('roomScene').querySelector('.arena-live-player.arena-self');
 if(el){el.style.left=roomPos.x+'%';el.style.top=roomPos.y+'%';el.classList.add('walking');el.dataset.direction=myPos.direction;el.style.setProperty('--arena-depth',String(.84+(roomPos.y-51)*.008))}
 sendPosition();
}
function move(dir){const [dx,dy]=dirs[dir]||[0,0];if($('roomScene').hidden){myPos.x=Math.max(4,Math.min(96,myPos.x+dx));myPos.y=Math.max(12,Math.min(94,myPos.y+dy));myPos.direction=dir;myPos.moving=true;const el=document.querySelector('.actor.me');if(el){el.style.left=myPos.x+'%';el.style.top=myPos.y+'%';el.classList.add('walking');el.dataset.direction=dir;clearTimeout(el.walkTimer);el.walkTimer=setTimeout(()=>el.classList.remove('walking'),220)}}else if(currentPlace==='arena'){moveArenaVector(dx,dy,1);return}else{roomPos.x=Math.max(4,Math.min(96,roomPos.x+dx*1.5));roomPos.y=Math.max(10,Math.min(88,roomPos.y+dy*1.5));myPos.direction=dir;myPos.moving=true;const el=$('roomScene').querySelector('.room-actor.me');if(el){el.style.left=roomPos.x+'%';el.style.top=roomPos.y+'%';el.classList.add('walking');el.dataset.direction=dir;clearTimeout(el.walkTimer);el.walkTimer=setTimeout(()=>el.classList.remove('walking'),220)}}sendPosition()}
function sendPosition(isMoving=true,force=false){if(!channel||!joined||(!force&&Date.now()-lastSend<70))return;lastSend=Date.now();channel.send({type:'broadcast',event:'position',payload:{user_id:user.id,name:nickname,role,gender,avatar,hair:characterHair,face:characterFace,x:myPos.x,y:myPos.y,roomX:roomPos.x,roomY:roomPos.y,scene:$('roomScene').hidden?'map':'room',place:currentPlace,moving:!!isMoving,direction:myPos.direction||'down'}});if(!isMoving)channel.track(profile())}
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;const map={ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'};if(map[e.key]){e.preventDefault();if(!keys[e.key])move(map[e.key]);keys[e.key]=true}});
document.addEventListener('keyup',e=>{keys[e.key]=false;if(!Object.values(keys).some(Boolean)){const el=document.querySelector('.actor.me,.room-actor.me');el?.classList.remove('walking');if(myPos.moving){myPos.moving=false;sendPosition(false,true)}}});window.addEventListener('blur',()=>{keys={};document.querySelectorAll('.actor.me,.room-actor.me').forEach(el=>el.classList.remove('walking'));myPos.moving=false;sendPosition()});
document.querySelectorAll('#roomScene [data-dir]').forEach(b=>{const d=b.dataset.dir;const start=e=>{e.preventDefault();move(d);clearInterval(b.repeat);b.repeat=setInterval(()=>move(d),90)};const end=()=>clearInterval(b.repeat);b.addEventListener('pointerdown',start);['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,end))});
function showPlace(p){currentPlace=p;$('placeTitle').textContent=placeData[p][0];$('placeDescription').textContent=placeData[p][1];$('placeModal').hidden=false}
document.querySelectorAll('.hotspot').forEach(b=>b.onclick=()=>showPlace(b.dataset.place));$('closePlace').onclick=()=>$('placeModal').hidden=true;$('enterPlace').onclick=()=>{ $('placeModal').hidden=true;enterPlace(currentPlace)};
function roomCharacter(p,id='me',name=nickname,roleValue=role,genderValue=gender,avatarValue=avatar){const img=roleValue==='teacher'?asset('male',0,0,0):asset(genderValue,avatarValue,id==='me'?characterHair:0,id==='me'?characterFace:0);const staticNpc=id==='teacher-npc';const isPeer=id!=='me'&&!staticNpc;return `<div class="room-actor ${id==='me'?'me':''} ${roleValue==='teacher'?'teacher-actor':''} ${staticNpc?'static-npc':''}" data-id="${safe(id)}" ${isPeer?'data-peer="true"':''} style="left:${p.x??50}%;top:${p.y??70}%" data-direction="${safe(p.direction||'down')}"><div class="speech"></div><img src="${img}"><span>${safe(name)}</span></div>`}
function roomStations(keys){const labels={vocabulary:['📖','TỪ VỰNG'],grammar:['📝','NGỮ PHÁP'],kanji:['🈶','KANJI'],reading:['📄','ĐỌC HIỂU'],listening:['🎧','NGHE HIỂU'],mock:['🏆','THI THỬ']};return `<div class="station-grid">${keys.map(k=>`<button class="station" data-action="${k}"><span>${labels[k][0]}</span>${labels[k][1]}</button>`).join('')}</div>`}
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

function enterPlace(p){roomQuizRequest++;window.IKIGAI_AUDIO?.play(p);currentPlace=p;$('mapScene').hidden=true;$('roomScene').hidden=false;let title='',inside='';
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
if(p==='n4'||p==='jft'){title=p==='n4'?'PHÒNG LUYỆN THI N4':'PHÒNG LUYỆN THI JFT';inside=`${decor}<div class="exam-room-art advanced-art"><div class="banner">${p==='n4'?'🏯 N4 · THỬ THÁCH TRUNG CẤP':'🎌 JFT-BASIC A2 · EXAM HALL'}</div><div class="exam-window">日本語 · CHALLENGE</div><div class="exam-podium">${p==='n4'?'N4':'A2'}<small>${p==='n4'?'日本語能力試験':'JFT-BASIC'}</small></div><div class="exam-bookcase">📚 📚 📚<small>THƯ VIỆN ĐỀ THI</small></div><div class="exam-headphones">🎧<small>LISTENING LAB</small></div><div class="exam-scroll">読む · 聞く · 書く · 話す</div><div class="room-actors">${roomCharacter(roomPos,'me')}</div>${roomStations(['vocabulary','grammar','kanji','reading','listening','mock'])}`}
if(p==='arena'){roomPos.x=48;roomPos.y=66;title='ĐẤU TRƯỜNG IKIGAI';inside=`<div class="arena-lobby-stage" aria-label="Sảnh Đấu Trường IKIGAI">
 <img class="arena-lobby-art" src="assets/ikigai-arena-background-title.png?v=10.3.5" alt="" aria-hidden="true" draggable="false">
 <header class="arena-topbar">
  <div class="arena-brand"><b>IKIGAI</b><small>WORLD · BATTLE ARENA</small></div>
  <div class="arena-player-profile"><img src="${role==='teacher'?asset('male',0,0,0):asset(gender,avatar,characterHair,characterFace)}" alt=""><span><b>${safe(nickname)}</b><small>Lv.${Math.floor(Number(xp||0)/100)+1} · ${safe(role==='teacher'?'Giáo viên':'Học viên')}</small></span></div>
  <div class="arena-wallet"><span>⭐ ${Number(coins||0).toLocaleString('vi-VN')}</span><span>✦ ${Number(xp||0).toLocaleString('vi-VN')} XP</span></div>
  <button class="arena-back" data-arena-ui="back" type="button">↩ Bản đồ</button>
 </header>
 <div id="roomMusicSlot" class="arena-music-slot" aria-label="Điều khiển nhạc nền"></div>
 <div class="arena-live-layout">
  <aside class="arena-chat-card">
   <button class="arena-panel-heading" id="arenaChatExpand" type="button" aria-expanded="false"><span>💬 PHÒNG CHAT</span><i>LIVE</i></button>
   <div class="arena-online-count" id="arenaOnlineCount">Đang kết nối người chơi…</div>
  </aside>
  <section class="arena-stage-center">
   <div class="arena-fire-ring" aria-hidden="true"><i></i><i></i><i></i></div>
   <div class="arena-peer-stage" id="arenaPeerStage">
    <div class="arena-live-player arena-self">
     <img src="${role==='teacher'?asset('male',0,0,0):asset(gender,avatar,characterHair,characterFace)}" alt="Nhân vật của bạn">
     <span class="arena-player-name">${safe(nickname)}</span><small>Lv.${Math.floor(Number(xp||0)/100)+1} · Bạn</small>
    </div>
   </div>
   <div class="arena-joystick" id="arenaJoystick" role="group" aria-label="Phím điều hướng nhân vật"><span class="joystick-direction up">▲</span><span class="joystick-direction right">▶</span><span class="joystick-direction down">▼</span><span class="joystick-direction left">◀</span><i class="joystick-thumb" id="arenaJoystickThumb"></i></div>
   <div class="arena-queue-status"><div id="arenaStatus">Chọn thể thức để tham gia đấu trường.</div><div id="arenaRoster" class="arena-roster-inline"></div><div class="arena-ready-actions"><button id="arenaReady" type="button" disabled>SẴN SÀNG</button><button id="arenaCancel" type="button" disabled>RỜI HÀNG CHỜ</button></div></div>
   <div class="arena-mode-row">
    <button class="arena-mode-btn arena-mode-blue" data-arena="1v1" type="button"><span>⚔️</span><b>1 vs 1</b><small>Đấu tập</small></button>
    <button class="arena-mode-btn arena-mode-purple" data-arena="2v2" type="button"><span>👥</span><b>2 vs 2</b><small>Đấu tập đồng đội</small></button>
    <button class="arena-mode-btn arena-mode-gold" data-arena-ui="ranked" type="button"><span>🏅</span><b>Xếp hạng 1v1</b><small>Thi đấu theo mùa</small></button>
   </div>
  </section>
  <aside class="arena-menu-card">
   <button class="arena-action" data-arena-ui="quick" type="button"><span>⚔️</span><b>Đấu nhanh</b></button>
   <button class="arena-action" data-arena-ui="create" type="button"><span>🏠</span><b>Tạo phòng</b></button>
   <button class="arena-action" data-arena-ui="rooms" type="button"><span>📋</span><b>Danh sách phòng</b></button>
   <button class="arena-action" data-arena-ui="rank" type="button"><span>🏆</span><b>Xếp hạng</b></button>
   <button class="arena-action" data-arena-ui="titles" type="button"><span>👑</span><b>Danh hiệu</b></button>
  </aside>
 </div>
 <footer class="arena-footer"><span>🌸 IKIGAI WORLD</span><span>Học tập · Giao lưu · Chinh phục</span><span id="arenaConnectionState">Đang tải trạng thái kết nối…</span></footer>
</div>`}
if(p==='gym'){title='PHÒNG GYM IKIGAI';inside=`${decor}<div class="gym-room-art"><div class="gym-motto">鍛錬 · DISCIPLINE · PROGRESS</div><div class="gym-mirror"></div><div class="gym-rack"><span>🏋️</span><small>POWER RACK</small></div><div class="gym-bike">🚴<small>CARDIO</small></div><div class="gym-dumbbells">🏋️‍♀️<small>TẠ TAY</small></div><div class="gym-medals">🏅 🥇 🏆<small>BẢNG THÀNH TÍCH</small></div><div class="gym-coach">💪<small>HUẤN LUYỆN VIÊN</small><b>「無理せず、続けよう！」</b></div><div class="room-actors">${roomCharacter(roomPos,'me')}</div><div class="speech-room">Cùng rèn luyện thể lực, an toàn và vừa sức nhé!</div><button class="room-action" data-action="gym">🏆 BẮT ĐẦU THỬ THÁCH</button>`}
if(p==='tea'){title='PHÒNG TRÀ';inside=`<div class="room-actors">${roomCharacter(roomPos,'me')}</div>`}
$('roomScene').innerHTML=`<header class="room-top ${p==='class'?'room-top-class':''} ${p==='tea'?'room-top-tea':''}">${p==='class'?'<div id="roomMusicSlot" class="room-music-slot"></div>':p==='tea'?'<div id="roomMusicSlot" class="tea-music-slot"></div><strong>PHÒNG TRÀ</strong>':`<strong>${title}</strong>`}<div class="room-top-actions">${role==='teacher'&&studyRooms.has(p)?'<button type="button" id="roomQuestionManager">📚 Nạp / sửa câu hỏi</button>':''}<button id="roomChatToggle">💬 CHAT</button><button id="backMap">↩ VỀ BẢN ĐỒ</button></div></header><div class="interior interior-${p}">${inside}${p==='class'||p==='tea'?'':`<div class="room-controls"><button data-dir="up">↑</button><button data-dir="left">←</button><button data-dir="down">↓</button><button data-dir="right">→</button></div>${roomFloatingNav(p)}`}</div>`;
if(p==='arena'){
 const chatHost=$('roomScene').querySelector('.arena-chat-card');
 if(chatHost){
  chatHost.appendChild($('chatbox'));
  $('chatbox').classList.remove('open');
  $('chatbox').classList.add('arena-inline-chat');
  chatHost.classList.add('chat-expanded');
  const expand=$('arenaChatExpand');
  if(expand){
   expand.setAttribute('aria-expanded','true');
   expand.onclick=()=>{
    const opened=chatHost.classList.toggle('chat-expanded');
    expand.setAttribute('aria-expanded',opened?'true':'false');
   };
  }
 }
 const joystick=$('arenaJoystick'),thumb=$('arenaJoystickThumb');
 if(joystick&&thumb){
  let joyPointer=null,joyTimer=null,joyVector={x:0,y:0,intensity:0};
  const stopJoy=()=>{
   if(joyTimer){clearInterval(joyTimer);joyTimer=null}
   joyPointer=null;joyVector={x:0,y:0,intensity:0};thumb.style.transform='translate(-50%,-50%)';
   joystick.classList.remove('active');if(myPos.moving){myPos.moving=false;sendPosition(false,true)}
  };
  const updateJoy=e=>{
   const r=joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
   const sx=e.clientX-cx,sy=e.clientY-cy;
   // The whole app canvas is rotated 90 degrees on portrait-held phones; map screen drag to landscape-local axes.
   const portraitRoom=window.matchMedia('(orientation: portrait) and (max-width: 900px)').matches;
   const vx=portraitRoom?sy:sx,vy=portraitRoom?-sx:sy,mag=Math.hypot(vx,vy);
   const maxRadius=Math.min(r.width,r.height)*.38;
   if(mag<7){joyVector={x:0,y:0,intensity:0};if(joyTimer){clearInterval(joyTimer);joyTimer=null}if(myPos.moving){myPos.moving=false;sendPosition(false,true)}thumb.style.transform='translate(-50%,-50%)';return}
   const scale=Math.min(1,mag/maxRadius),radius=Math.min(r.width,r.height)*.31;
   // Keep the thumb under the finger while sending a continuous 2D movement vector.
   thumb.style.transform=`translate(calc(-50% + ${vx/mag*radius*scale}px),calc(-50% + ${vy/mag*radius*scale}px))`;
   joyVector={x:vx/mag,y:vy/mag,intensity:Math.max(.35,scale)};
   if(!joyTimer)joyTimer=setInterval(()=>{if(joyVector.intensity>0)moveArenaVector(joyVector.x,joyVector.y,joyVector.intensity)},75);
  };
  joystick.addEventListener('pointerdown',e=>{e.preventDefault();joyPointer=e.pointerId;joystick.setPointerCapture?.(e.pointerId);joystick.classList.add('active');updateJoy(e)});
  joystick.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer)updateJoy(e)});
  joystick.addEventListener('pointerup',e=>{if(e.pointerId===joyPointer)stopJoy()});
  joystick.addEventListener('pointercancel',stopJoy);joystick.addEventListener('lostpointercapture',stopJoy);
 }
}if(p==='class'||p==='arena'||p==='tea')mountRoomMusicToggle();else restoreMusicToggle();
$('roomQuestionManager')?.addEventListener('click',e=>openQuestionManager(p,e.currentTarget));
$('backMap').onclick=backMap;$('roomScene').querySelector('[data-nav-back]')?.addEventListener('click',backMap);$('roomChatToggle').onclick=()=>{if(currentPlace==='arena'){ $('arenaChatExpand')?.click();return }$('chatbox').classList.toggle('open');$('chatInput').focus()};$('roomScene').querySelector('[data-npc="tung"]')?.addEventListener('click',()=>toast('Giám đốc: Ngồi xuống, cầm chén trà bằng hai tay nhé!'));
$('roomScene').querySelectorAll('.room-actor').forEach(el=>el.onclick=()=>{const id=el.dataset.id;if(id==='me')toast('Đây là nhân vật của bạn!');else{const p=people[id];if(p){if(channel&&joined)channel.send({type:'broadcast',event:'bubble',payload:{user_id:user.id,target:id,text:'Xin chào! Cùng học nhé!'}});toast('Đã gửi lời chào đến '+p.name)}}});$('roomScene').querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>roomAction(b.dataset.action));
$('roomScene').querySelectorAll('[data-arena-ui]').forEach(b=>b.addEventListener('click',()=>{
 const action=b.dataset.arenaUi;
 if(action==='chat'){$('chatbox').classList.toggle('open');$('chatInput')?.focus();return}
 if(action==='back'){backMap();return}
 if(action==='ranked'){openRankedArena();return}
 if(action==='quick'){joinArenaQueue('1v1');return}
 if(action==='rank'||action==='titles'){showWorldLeaderboard('arena');return}
 const labels={create:'Tạo phòng riêng sẽ được kết nối ở giai đoạn tiếp theo.',rooms:'Danh sách phòng đang được hoàn thiện.'};
 toast(labels[action]||'Chức năng đang được hoàn thiện');
}));
$('roomScene').querySelectorAll('[data-arena]').forEach(b=>b.addEventListener('click',()=>joinArenaQueue(b.dataset.arena)));
renderArenaLobbyPeers();
$('arenaReady')?.addEventListener('click',()=>setArenaReady(true));
$('arenaCancel')?.addEventListener('click',leaveArenaQueue);
$('roomScene').querySelectorAll('[data-dir]').forEach(b=>{b.onclick=()=>move(b.dataset.dir)});if(channel&&joined){channel.track(profile());channel.send({type:'broadcast',event:'scene',payload:{user_id:user.id,name:nickname,scene:'room',place:p}})}renderRoomPeers();if(currentPlace==='class'&&channel&&joined)channel.track(profile())}

function renderArenaLobbyPeers(){
 const host=$('arenaPeerStage');if(!host)return;
 const self={user_id:user?.id,name:nickname,role,gender,avatar,hair:characterHair,face:characterFace,xp};
 const peers=Object.values(people).filter(p=>p.user_id!==user?.id&&p.scene==='room'&&p.place==='arena');
 const all=[self,...peers].slice(0,5);
 host.innerHTML=all.map((p,i)=>{
  const level=rankLevel(p.xp||0),rank=classRanks[level-1]||classRanks[0];
  const avatarSrc=p.role==='teacher'?asset('male',0,0,0):asset(p.gender||'male',p.avatar||0,p.hair||0,p.face||0);
  const px=i===0?(roomPos.x??50):(p.roomX??50),py=i===0?(roomPos.y??72):(p.roomY??72);
  return `<div class="arena-live-player ${i===0?'arena-self':'arena-peer'}" data-player-id="${safe(p.user_id||user?.id||'self')}" style="left:${Math.max(4,Math.min(96,px))}%;top:${Math.max(8,Math.min(94,py))}%">
   <div class="arena-player-overhead">
    <span class="arena-player-name">${safe(p.name||'Học viên')}</span>
    <span class="arena-player-title"><b>${rank.icon}</b> ${safe(rank.name)}</span>
    <small>Lv.${level}${i===0?' · Bạn':''}</small>
   </div>
   <img src="${avatarSrc}" alt="${safe(p.name||'Nhân vật')}" draggable="false">
  </div>`;
 }).join('');
 const count=$('arenaOnlineCount');if(count)count.textContent=`${peers.length+1} người trong sảnh`;
 const state=$('arenaConnectionState');if(state)state.textContent=channel&&joined?'● Đã kết nối máy chủ':'○ Chế độ ngoại tuyến';
}
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
 if($('arenaReady'))$('arenaReady').disabled=false;if($('arenaCancel'))$('arenaCancel').disabled=false;
 const arenaStatus=$('arenaStatus');if(arenaStatus)arenaStatus.textContent=`Đã vào hàng chờ ${mode.toUpperCase()}. Nhấn SẴN SÀNG khi bạn đã sẵn sàng.`;
 updateArenaLobby();
}
async function setArenaReady(value){
 if(!arenaMode)return;
 arenaReady=!!value;await publishArenaState();updateArenaLobby();
}
async function leaveArenaQueue(){
 stopArenaMatch();$('arenaBattle')?.remove();
 arenaMode='';arenaReady=false;
 if(channel&&joined)await channel.track(profile());
 $('arenaReady')?.setAttribute('disabled','');$('arenaCancel')?.setAttribute('disabled','');
 if($('arenaStatus'))$('arenaStatus').textContent='Bạn đã rời hàng chờ.';
 if($('arenaRoster'))$('arenaRoster').innerHTML='';
}
function updateArenaLobby(){
 const status=$('arenaStatus'),roster=$('arenaRoster');
 if(!status||!roster||!channel||arenaMatch||rankedSession)return;
 if(!arenaMode){status.textContent='Chọn thể thức 1–1 hoặc 2–2 để tham gia.';if(roster)roster.innerHTML='';return}
 const needed=arenaMode==='1v1'?2:4;
 const list=arenaPlayers().filter(p=>p.arenaMode===arenaMode).sort((a,b)=>String(a.user_id).localeCompare(String(b.user_id)));
 const mine=list.some(p=>p.user_id===user.id);
 const own={user_id:user.id,name:nickname,arenaReady,arenaMode};
 if(!mine)list.push(own);
 const rosterList=list.slice(0,needed);
 roster.innerHTML=rosterList.map(p=>`<div class="arena-player ${p.arenaReady?'ready':''}"><span>${safe(p.name||'Học viên')}</span><b>${p.arenaReady?'✓ Sẵn sàng':'Đang chờ'}</b></div>`).join('');
 status.textContent=`${Math.min(list.length,needed)}/${needed} người · ${arenaReady?'Bạn đã sẵn sàng':'Bạn chưa sẵn sàng'}`;
 const matched=list.length>=needed&&rosterList.length===needed&&rosterList.every(p=>p.arenaReady)&&rosterList.some(p=>p.user_id===user.id);
 if(!matched){if(!arenaMatch)$('arenaBattle')?.remove();return}
 if($('arenaBattle')||arenaMatch)return;
 const teams=arenaMode==='1v1'
  ?[rosterList.slice(0,1),rosterList.slice(1,2)]
  :[rosterList.slice(0,2),rosterList.slice(2,4)];
 const playerCard=(p)=>`<div class="arena-match-player"><span class="arena-match-avatar">👤</span><strong>${safe(p.name||'Học viên')}</strong><small>✓ SẴN SÀNG</small></div>`;
 $('roomScene').insertAdjacentHTML('beforeend',`<div class="arena-battle-modal arena-match-overlay" id="arenaBattle" role="dialog" aria-modal="true" aria-label="Ghép cặp đấu trường">
  <div class="arena-match-panel">
   <div class="arena-match-eyebrow">IKIGAI EDUCATION · BATTLE ARENA</div>
   <h2>⚔️ GHÉP CẶP THÀNH CÔNG</h2>
   <p class="arena-match-subtitle">${arenaMode==='1v1'?'ĐỐI KHÁNG 1 VS 1':'ĐỒNG ĐỘI 2 VS 2'} · Tất cả đã sẵn sàng</p>
   <div class="arena-match-versus">
    <section class="arena-match-team"><b>ĐỘI XANH</b>${teams[0].map(playerCard).join('')}</section>
    <span class="arena-match-vs">VS</span>
    <section class="arena-match-team"><b>ĐỘI TÍM</b>${teams[1].map(playerCard).join('')}</section>
   </div>
   <div class="arena-levels"><button class="arena-level active" type="button">N5 · 20 CÂU</button><button class="arena-level locked" disabled type="button">🔒 N4 · SẮP MỞ</button></div><p class="arena-match-note">Cùng 20 câu N5 · 15 giây/câu · Đồng bộ thời gian và bảng điểm trực tuyến</p>
   <div class="arena-match-actions"><button class="gold" id="startArenaQuiz" type="button">⚡ VÀO TRẬN</button><button class="secondary" id="closeArenaBattle" type="button">RỜI TRẬN</button></div>
  </div>
 </div>`);
 $('startArenaQuiz')?.addEventListener('click',requestArenaStart);
 $('closeArenaBattle')?.addEventListener('click',()=>{stopArenaMatch();leaveArenaQueue()});

}

// IKIGAI ARENA 10.4.2: deterministic host-selected match, common timeline and live score.
// Realtime Broadcast is a classroom-friendly prototype, not a tamper-proof ranked server.
const ARENA_SECONDS=15,ARENA_ROUNDS=20;
function arenaSend(kind,data={}){if(channel&&joined)return channel.send({type:'broadcast',event:'arena-match',payload:{kind,from:user.id,...data}})}
function arenaRoster(){const need=arenaMode==='1v1'?2:4;const a=arenaPlayers().filter(p=>p.arenaMode===arenaMode&&p.arenaReady).sort((x,y)=>String(x.user_id).localeCompare(String(y.user_id)));if(!a.some(p=>p.user_id===user.id)&&arenaReady)a.push({user_id:user.id,name:nickname,arenaReady:true});return a.sort((x,y)=>String(x.user_id).localeCompare(String(y.user_id))).slice(0,need)}
function arenaSeedQuestions(){const groups=['vocabulary','grammar','kanji'];const chosen=[];for(const [g,n] of [['vocabulary',7],['grammar',7],['kanji',6]]){const pool=bank.filter(q=>q.group===g&&q.options?.length===4&&'ABCD'.includes(q.correct));if(pool.length<n)return null;chosen.push(...shuffle(pool).slice(0,n).map(q=>q.id))}return shuffle(chosen)}
function requestArenaStart(){if(!joined){toast('Cần kết nối máy chủ để giao đấu đồng bộ');return}const roster=arenaRoster();const needed=arenaMode==='1v1'?2:4;if(roster.length!==needed){toast('Chưa đủ người chơi sẵn sàng');return}const host=roster[0].user_id;if(user.id!==host){toast('Đang chờ chủ trận bắt đầu…');arenaSend('start-request',{host});return}startArenaHost(roster)}
function startArenaHost(roster){if(arenaMatch)return;const ids=arenaSeedQuestions();if(!ids){toast('Ngân hàng N5 chưa đủ câu hỏi');return}const id=crypto.randomUUID();const payload={id,mode:arenaMode,players:roster.map(p=>({id:p.user_id,name:p.name||'Học viên'})),ids,startedAt:Date.now()+3500,seconds:ARENA_SECONDS};arenaSend('start',payload);acceptArenaStart(payload)}
function handleArenaMatchEvent(e){if(!e||currentPlace!=='arena'||!user||rankedSession)return;
 if(e.kind==='start-request'){if(arenaReady&&arenaRoster()[0]?.user_id===user.id&&!arenaMatch)startArenaHost(arenaRoster());return}
 if(e.kind==='start'){if(!e.players?.some(p=>p.id===user.id))return;acceptArenaStart(e);return}
 if(!arenaMatch||e.id!==arenaMatch.id||!arenaMatch.players.some(p=>p.id===e.from))return;
 if(e.kind==='answer'){const key=e.from+':'+e.round;if(arenaMatchAnswers[key]||e.round<0||e.round>=20)return;arenaMatchAnswers[key]=true;const q=arenaMatch.questions[e.round];if(!q)return;const ok=e.answer===q.correct;const pts=ok?100:0;arenaMatchResults[e.from]=(arenaMatchResults[e.from]||0)+pts;renderArenaBattle();return}
 if(e.kind==='score-sync'&&e.from===arenaMatch.players[0].id){arenaMatchResults={...e.scores};renderArenaBattle();return}
}
function acceptArenaStart(m){if(arenaMatch||!Array.isArray(m.ids)||m.ids.length!==20||!Array.isArray(m.players)||!m.players.some(p=>p.id===user.id))return;const lookup=new Map(bank.map(q=>[String(q.id),q]));const questions=m.ids.map(id=>lookup.get(String(id)));if(questions.some(q=>!q)){toast('Không thể tải đủ câu hỏi trận đấu');return}arenaMatch={...m,questions};arenaMatchResults=Object.fromEntries(m.players.map(p=>[p.id,0]));arenaMatchAnswers={};arenaMatchFinalized=false;$('arenaBattle')?.remove();renderArenaBattle();clearInterval(arenaMatchTick);arenaMatchTick=setInterval(arenaBattleClock,150);arenaBattleClock()}
function arenaRound(){if(!arenaMatch)return -1;return Math.floor((Date.now()-arenaMatch.startedAt)/(arenaMatch.seconds*1000))}
function arenaTeamScore(team){const a=arenaMatch?.players||[];const ids=team===0?a.slice(0,arenaMatch.mode==='1v1'?1:2):a.slice(arenaMatch.mode==='1v1'?1:2);return ids.reduce((n,p)=>n+(arenaMatchResults[p.id]||0),0)}
function arenaSound(kind){
 // Original synthesized game cues, no external copyrighted music files.
 try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
 const ctx=arenaSound.ctx||(arenaSound.ctx=new Audio());if(ctx.state==='suspended')ctx.resume().catch(()=>{});
 const sequences={correct:[[784,0,.10],[988,.09,.12],[1175,.19,.22]],wrong:[[392,0,.17],[294,.16,.24]],win:[[523,0,.16],[659,.14,.16],[784,.28,.18],[1047,.43,.24],[1319,.65,.35],[1568,.90,.46]],lose:[[392,0,.28],[349,.22,.28],[294,.44,.32],[220,.70,.50]],draw:[[523,0,.2],[659,.2,.2],[523,.4,.35]]};
 (sequences[kind]||[]).forEach(([hz,delay,duration],i)=>{const t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();o.type=kind==='lose'?'triangle':kind==='wrong'?'square':'sine';o.frequency.setValueAtTime(hz,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(kind==='wrong'?.035:.07,t+.025);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+duration+.02)});
 }catch(e){console.warn('Arena sound unavailable:',e)}
}
function renderArenaBattle(){const m=arenaMatch;if(!m)return;let root=$('arenaBattle');if(!root){$('roomScene').insertAdjacentHTML('beforeend','<div id="arenaBattle" class="arena-battle-modal arena-match-overlay arena-live-battle" role="dialog" aria-modal="true"><div class="arena-match-panel arena-live-panel" id="arenaBattleContent"></div></div>');root=$('arenaBattle')}
 const round=arenaRound(),i=Math.min(19,Math.max(0,round)),q=m.questions[i],team0=arenaTeamScore(0),team1=arenaTeamScore(1),total=Math.max(1,team0+team1),mine=m.players.findIndex(p=>p.id===user.id),answered=!!arenaMatchAnswers[user.id+':'+i],remaining=Math.max(0,Math.ceil((m.startedAt+(i+1)*m.seconds*1000-Date.now())/1000));
 const end=round>=20;if(end){renderArenaResult();return}
 const options=q.options.map((a,n)=>`<button class="arena-answer" data-arena-answer="${'ABCD'[n]}" ${answered||round<0?'disabled':''}>${'ABCD'[n]}. ${safe(a)}</button>`).join('');
 const left=m.players.slice(0,m.mode==='1v1'?1:2).map(p=>safe(p.name)).join(' + '),right=m.players.slice(m.mode==='1v1'?1:2).map(p=>safe(p.name)).join(' + ');
 const el=$('arenaBattleContent');if(!el)return;el.innerHTML=`<div class="arena-battle-head"><span>⚔️ IKIGAI · N5 BATTLE</span><button class="arena-exit" id="arenaExit">✕ Rời trận</button></div><div class="arena-battle-score"><div>🔵 ${left}<strong>${team0}</strong></div><div class="arena-battle-round">CÂU ${i+1}/20 <b id="arenaClock">${round<0?'CHUẨN BỊ':remaining+'s'}</b></div><div>🟣 ${right}<strong>${team1}</strong></div></div><div class="arena-duel-bar"><i style="width:${team0+team1?100*team0/total:50}%"></i></div><div class="arena-battle-track"><i style="width:${Math.max(0,round)/20*100}%"></i></div><div class="arena-question-type">${({vocabulary:'TỪ VỰNG',grammar:'NGỮ PHÁP',kanji:'KANJI'})[q.group]||'N5'}</div><div class="arena-battle-question">${safe(q.question)}</div><div class="arena-battle-answers">${options}</div><div class="arena-battle-feedback" id="arenaBattleFeedback">${round<0?'Trận đấu sắp bắt đầu…':answered?'Đã ghi nhận câu trả lời · Đợi câu tiếp theo':'Chọn đáp án trước khi hết giờ!'}</div>`;
 el.querySelector('#arenaExit').onclick=()=>{stopArenaMatch();leaveArenaQueue()};el.querySelectorAll('[data-arena-answer]').forEach(b=>b.onclick=()=>answerArena(b.dataset.arenaAnswer));}
function answerArena(answer){const m=arenaMatch,round=arenaRound();if(!m||round<0||round>=20||arenaMatchAnswers[user.id+':'+round])return;const q=m.questions[round],ok=answer===q.correct;arenaMatchAnswers[user.id+':'+round]=true;arenaMatchResults[user.id]=(arenaMatchResults[user.id]||0)+(ok?100:0);arenaSend('answer',{id:m.id,round,answer});arenaSound(ok?'correct':'wrong');renderArenaBattle();const f=$('arenaBattleFeedback');if(f){f.textContent=ok?'✨ 正解 · CHÍNH XÁC! +100':'💥 不正解 · CHƯA CHÍNH XÁC!';f.classList.toggle('arena-feedback-correct',ok);f.classList.toggle('arena-feedback-wrong',!ok)}}
let arenaLastRound=-999;
function arenaBattleClock(){if(!arenaMatch)return;const r=arenaRound();if(r!==arenaLastRound){arenaLastRound=r;renderArenaBattle()}else{const el=$('arenaClock');if(el){const rem=Math.max(0,Math.ceil((arenaMatch.startedAt+(r+1)*arenaMatch.seconds*1000-Date.now())/1000));el.textContent=r<0?'CHUẨN BỊ':rem+'s'}}if(r>=20){clearInterval(arenaMatchTick);renderArenaResult()} }
function renderArenaResult(){const m=arenaMatch;if(!m||arenaMatchFinalized)return;arenaMatchFinalized=true;
 const a=arenaTeamScore(0),b=arenaTeamScore(1),mine=m.players.findIndex(p=>p.id===user.id)<(m.mode==='1v1'?1:2),mineScore=mine?a:b,otherScore=mine?b:a;
 const result=a===b?'draw':mineScore>otherScore?'win':'lose';arenaSound(result);
 const labels={win:['勝ち','CHIẾN THẮNG','🏆'],lose:['負け','THẤT BẠI','⚔️'],draw:['引き分け','HÒA','🤝']};const [jp,vi,emoji]=labels[result];
 const el=$('arenaBattleContent');if(!el)return;
 el.innerHTML=`<div class="arena-result arena-result-gunny ${result==='win'?'victory':result==='lose'?'defeat':'draw'}"><div class="arena-result-rays" aria-hidden="true"></div><div class="arena-result-icon">${emoji}</div><div class="arena-result-jp" lang="ja">${jp}</div><h2>${vi}</h2><p class="arena-result-score">🔵 ĐỘI XANH <b>${a}</b> <span>VS</span> <b>${b}</b> ĐỘI TÍM 🟣</p><small>HOÀN THÀNH 20 CÂU HỎI N5</small><button class="gold" id="arenaResultExit">TRỞ VỀ SẢNH</button></div>`;
 el.querySelector('#arenaResultExit').onclick=()=>{stopArenaMatch();leaveArenaQueue()};
}
function stopArenaMatch(){clearInterval(arenaMatchTick);arenaMatchTick=null;arenaMatch=null;arenaMatchAnswers={};arenaMatchResults={};arenaMatchFinalized=false;arenaLastRound=-999;$('arenaBattle')?.remove()}

function renderRoomPeers(){if(currentPlace==='arena')renderArenaLobbyPeers();if(currentPlace==='class')return;const host=$('roomScene').querySelector('.room-actors');if(!host)return;host.querySelectorAll('.room-actor[data-peer="true"]').forEach(el=>el.remove());Object.values(people).filter(p=>p.scene==='room'&&p.place===currentPlace&&p.user_id!==user.id).forEach(p=>host.insertAdjacentHTML('beforeend',roomCharacter({x:p.roomX??50,y:p.roomY??70},p.user_id||p.id,p.name,p.role,p.gender,p.avatar)))}
function backMap(){if(rankedSession){toast('Hãy rời màn hình xếp hạng trước khi về bản đồ.');return}roomQuizRequest++;stopArenaMatch();$('chatbox').classList.remove('open','arena-inline-chat');$('roomScene').querySelector('.arena-chat-card')?.classList.remove('chat-expanded');if($('chatbox').parentElement!==document.body)document.body.appendChild($('chatbox'));restoreMusicToggle();window.IKIGAI_AUDIO?.play('map');if(arenaMode)leaveArenaQueue();$('roomScene').hidden=true;$('mapScene').hidden=false;if(channel&&joined){channel.track(profile());channel.send({type:'broadcast',event:'scene',payload:{user_id:user.id,name:nickname,scene:'map',place:'map'}})}renderActors()}
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
 roomQuizRequest++;
 activeGroup=group;
 const label=studyGroupLabels[group];
 setClassBoard(label+' · TỰ HỌC CÁ NHÂN','CHỌN BÀI 1–25','Chọn bài Minna no Nihongo bạn muốn luyện tập.',
 Array.from({length:25},(_,i)=>`<button class="board-choice lesson-choice" data-lesson="${i+1}">Bài ${i+1}</button>`).join(''));
 const lessonOptions=$('classBoardOptions');
 if(lessonOptions)lessonOptions.scrollTop=0;
 lessonOptions?.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>startLessonGame(group,Number(b.dataset.lesson)));
}
async function startLessonGame(group,lesson){
 const request=++roomQuizRequest;
 const rows=await getStudyQuestions('class');
 if(request!==roomQuizRequest||$('roomScene').hidden)return;
 activeGroup=group;
 const source=rows.filter(q=>q.group===group&&Number(q.lesson)===lesson);
 qset=shuffle(source).slice(0,10);
 if(!qset.length){
  setClassBoard('CHƯA CÓ DỮ LIỆU','BÀI '+lesson,'Chưa có câu hỏi cho bài này.',
   '<button class="board-choice" id="backToLessons">CHỌN BÀI KHÁC</button>');
  $('backToLessons')?.addEventListener('click',()=>openLessonPicker(group));return;
 }
 qpos=0;score=0;renderClassGame(lesson);
}
function renderClassGame(lesson){
 const q=qset[qpos],correct='ABCD'.indexOf(q.correct),kind=studyGroupLabels[activeGroup];
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
 if(a==='listening'){
  roomQuizRequest++;
  if(currentPlace==='class')setClassBoard('NGHE HIỂU','CHƯA CÓ ÂM THANH','Bài nghe sẽ được bổ sung khi có ngân hàng âm thanh.','');
  else info('Nghe hiểu','Phòng chưa có ngân hàng âm thanh.');
  return;
 }
 if(currentPlace==='class'&&['vocabulary','grammar','kanji','kaiwa'].includes(a)){openLessonPicker(a);return}
 if(['vocabulary','grammar','kanji','reading','mock','duel'].includes(a)){startQuiz(a);return}
 if(a==='rules'){info('Luật đấu tập','Mỗi câu trả lời đúng được 10 XP. Hiện tại là đấu tập cục bộ, chưa phải ghép trận trực tuyến.');return}
 if(a==='gym'){info('Thử thách Gym','Chọn một hoạt động an toàn: đi bộ tại chỗ 1 phút, vươn vai 10 lần hoặc hít thở và giãn cơ. Không cố quá sức.');return}
 if(a==='tea'){info('Anh Tùng','“Uống trà với anh nhé”. Nghỉ ngơi một chút rồi tiếp tục hành trình học tập nhé.');return}
}

function info(title,txt){const a=$('activity');a.hidden=false;a.innerHTML=`<button class="close-activity">×</button><small>IKIGAI WORLD</small><h2>${title}</h2><p>${txt}</p><button class="gold" id="infoOk">ĐÃ HIỂU</button>`;a.querySelector('.close-activity').onclick=()=>a.hidden=true;$('infoOk').onclick=()=>a.hidden=true}
function shuffle(a){const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
async function startQuiz(group){
 const room=currentPlace,request=++roomQuizRequest;
 const available=group==='duel'||!studyRooms.has(room)?bank:await getStudyQuestions(room);
 if(request!==roomQuizRequest||$('roomScene').hidden)return;
 const isMock=group==='mock'||group==='duel';
 const dedicated=available.filter(q=>q.group===group);
 const rows=isMock&&!dedicated.length?available.filter(q=>['vocabulary','grammar','kanji'].includes(q.group)):dedicated;
 if(!rows.length){info('Chưa có dữ liệu','Chưa có câu hỏi cho mục này trong phòng.');return}
 activeGroup=group;qset=shuffle(rows).slice(0,isMock?20:10);qpos=0;score=0;renderQuestion();
}
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
// IKIGAI 10.4.5 — Hall of Fame: rankings are server-backed and never generated locally.
const hallRankTabs=document.querySelectorAll('[data-rank-tab]');
let hallRankRows=[];
function hallLevel(x){return rankLevel(Number(x)||0)}
function hallTitle(x){return classRanks[hallLevel(x)-1]?.name||'Tân binh'}
function hallPortrait(p){return asset(p.gender||'male',p.avatar||0,p.hair||0,p.face||0)}
function hallSafe(v){return safe(String(v??''))}
function renderHallPodium(rows){
 const podium=$('hallPodium');if(!podium)return;
 const order=[1,0,2];
 podium.innerHTML=order.map((index)=>{
  const p=rows[index],rank=index+1;
  if(!p)return `<div class="hall-place empty place-${rank}"><span>✦</span><small>Chưa có hạng ${rank}</small></div>`;
  return `<article class="hall-place place-${rank}">
   <div class="hall-place-glow"></div>
   <span class="hall-place-crown" aria-hidden="true">${rank===1?'👑':rank===2?'🥈':'🥉'}</span>
   <img src="${hallPortrait(p)}" alt="Nhân vật ${hallSafe(p.nickname)}">
   <div class="hall-place-step">
    <strong class="hall-medal" aria-label="Hạng ${rank}">${rank}</strong>
    <b class="hall-podium-name" title="${hallSafe(p.nickname)}">${hallSafe(p.nickname)}</b>
    <div class="hall-podium-stats"><b class="hall-level">Lv.${hallLevel(p.xp)}</b><b class="hall-exp">${Number(p.xp||0).toLocaleString('vi-VN')} EXP</b></div>
    <small class="hall-rank-title" title="${hallSafe(hallTitle(p.xp))}">${hallSafe(hallTitle(p.xp))}</small>
   </div>
  </article>`;
 }).join('');
}
function renderHallList(rows){
 const list=$('worldLeaderboardList');if(!list)return;
 const remaining=rows.slice(3,100);
 list.innerHTML=remaining.length?remaining.map((p,i)=>`<article class="hall-rank-row">
  <b class="hall-rank-number">${i+4}</b>
  <span class="hall-rank-person"><img src="${hallPortrait(p)}" alt=""><strong title="${hallSafe(p.nickname)}">${hallSafe(p.nickname)}</strong></span>
  <b class="hall-level">Lv.${hallLevel(p.xp)}</b>
  <b class="hall-exp">${Number(p.xp||0).toLocaleString('vi-VN')}</b>
  <span class="hall-rank-title" title="${hallSafe(hallTitle(p.xp))}">${hallSafe(hallTitle(p.xp))}</span>
 </article>`).join(''):'<p class="hall-empty-list">Chưa có học viên từ hạng 4 trở đi.</p>';
}
function renderHallSelf(rows){
 const me=rows.find(p=>p.user_id===user?.id);
 const myXp=Number(me?.xp??xp??0);
 const level=hallLevel(myXp);
 const idx=rows.findIndex(p=>p.user_id===user?.id);
 $('hallMyRank').textContent=idx>=0?'#'+(idx+1):'★';
 $('hallMyName').textContent=me?.nickname||nickname||'Học viên IKIGAI';
 $('hallMyTitle').textContent=hallTitle(myXp);
 $('hallMyXp').textContent=`Lv.${level} · ${myXp.toLocaleString('vi-VN')} EXP`;
 const next=level>=10?100:Math.max(0,Math.min(100,myXp%100));
 $('hallProgressFill').style.width=next+'%';
}
function hallSetTab(tab){
 hallRankTabs.forEach(b=>{const active=b.dataset.rankTab===tab;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
 $('hallAllTime').hidden=tab!=='all';
 $('hallUnavailable').hidden=tab==='all'||tab==='arena';
 $('hallArenaSeason').hidden=tab!=='arena';
 $('hallLearningFooter').hidden=tab==='arena';
 if(tab==='arena')loadArenaSeason();
}
async function showWorldLeaderboard(tab){
 const modal=$('worldLeaderboard');if(!modal)return;
 modal.hidden=false;hallSetTab(tab==='arena'?'arena':'all');
 if(tab==='arena')return;
 $('hallPodium').innerHTML='<p class="hall-loading">Đang tải dữ liệu...</p>';
 $('worldLeaderboardList').innerHTML='';
 renderHallSelf([]);
 if(!client||!user||role==='guest'){
  $('hallPodium').innerHTML='<p class="hall-loading">Đăng nhập để xem bảng xếp hạng.</p>';return;
 }
 try{
  const {data,error}=await client.rpc('ikigai_world_leaderboard');
  if(error)throw error;
  hallRankRows=Array.isArray(data)?data:[];
  renderHallPodium(hallRankRows);renderHallList(hallRankRows);renderHallSelf(hallRankRows);
 }catch(e){
  console.error('Leaderboard:',e);
  $('hallPodium').innerHTML='<p class="hall-loading">Không tải được xếp hạng. Hãy kiểm tra RPC Supabase.</p>';
 }
}
hallRankTabs.forEach(b=>b.addEventListener('click',()=>{
 if(b.dataset.rankTab==='all'){showWorldLeaderboard();return}
 hallSetTab(b.dataset.rankTab);
}));
$('openWorldLeaderboard')?.addEventListener('click',showWorldLeaderboard);
$('closeWorldLeaderboard')?.addEventListener('click',()=>{$('worldLeaderboard').hidden=true});

function arenaSeasonLabel(date){
 return String(date).slice(0,7).split('-').reverse().join('/');
}

let arenaBoardRequest=0;
async function loadArenaSeason(){
 const panel=$('hallArenaSeason');
 const requestId=++arenaBoardRequest;
 if(!client||!user||role==='guest'){
  panel.textContent='Đăng nhập để xem xếp hạng Đấu trường.';
  return;
 }
 panel.textContent='Đang tải mùa giải…';
 try{
  const {data,error}=await client.rpc('ikigai_ranked_board');
  if(requestId!==arenaBoardRequest)return;
  if(error)throw error;
  const {mine,leaders,badges}=data;
  const badgeNames=['Hoàng Kim','Băng Lam','Hỏa Diệm'];
  const placement=mine.games<5?`Phân hạng ${mine.games}/5`:`Hạng #${mine.place} · ${safe(mine.title)}`;
  const cutoff=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short'}).format(new Date(data.ends_at));
  panel.innerHTML=`<h3>⚔️ ĐẤU TRƯỜNG · MÙA ${safe(arenaSeasonLabel(data.season))}</h3>
   <p>Chốt mùa lúc 00:00 ngày ${safe(cutoff)} (giờ Việt Nam)</p>
   ${role==='student'?`<p><strong>${Number(mine.rating).toLocaleString('vi-VN')} điểm</strong> · ${placement}</p>`:''}
   ${leaders.length?`<table><thead><tr><th>Hạng</th><th>Học viên</th><th>Điểm</th><th>Danh hiệu</th></tr></thead>
    <tbody>${leaders.map(p=>`<tr><td>${Number(p.place)}</td><td>${safe(p.nickname)}</td><td>${Number(p.rating).toLocaleString('vi-VN')}</td><td>${safe(p.title)}</td></tr>`).join('')}</tbody></table>`:'<p>Chưa có học viên hoàn tất 5 trận phân hạng.</p>'}
   ${role==='student'?`<p class="arena-season-badges">🏅 Huy hiệu các mùa đã chốt · ${badges.length?badges.map(b=>`<span>#${Number(b.place)} ${badgeNames[b.place-1]} · ${safe(arenaSeasonLabel(b.season))}</span>`).join(' '):'Chưa có huy hiệu'}</p>`:''}`;
 }catch(error){
  if(requestId!==arenaBoardRequest)return;
  console.error('Ranked leaderboard:',error);
  panel.textContent='Chưa tải được mùa giải Đấu trường. Vui lòng thử lại.';
 }
}

let rankedSession=null;
async function openRankedArena(){
 if(rankedSession||arenaMatch)return;
 if(role!=='student'||!client||!profileLoaded){
  toast('Hãy đăng nhập bằng tài khoản học viên đã đồng bộ để đấu xếp hạng.');
  return;
 }
 const session={closing:false,timer:null,pending:null,data:null,view:''};
 rankedSession=session;
 try{await leaveArenaQueue()}catch(error){
  rankedSession=null;
  console.error('Leaving practice arena:',error);
  toast('Chưa thể rời hàng chờ đấu tập. Hãy thử lại.');
  return;
 }
 $('roomScene').insertAdjacentHTML('beforeend',`<div id="arenaRankedOverlay" class="arena-battle-modal arena-match-overlay arena-live-battle" role="dialog" aria-modal="true" aria-label="Đấu xếp hạng 1v1">
  <div class="arena-match-panel arena-live-panel arena-ranked-panel">
   <div class="arena-battle-head"><span>⚔️ XẾP HẠNG 1 VS 1 · N5</span><button id="arenaRankedExit" class="arena-exit" type="button">Rời đấu trường</button></div>
   <div id="arenaRankedContent"></div><p id="arenaRankedStatus" role="status">Đang kết nối…</p>
  </div></div>`);
 $('arenaRankedExit').onclick=()=>closeRankedArena(session);
 $('arenaRankedExit').focus();
 await rankedRequest(session,'join');
}

async function rankedRequest(session,action,args={}){
 clearTimeout(session.timer);
 if(session.pending)await session.pending;
 if(session.closing||session!==rankedSession)return;
 clearTimeout(session.timer);
 const operation=(async()=>{
  try{
   const {data,error}=await client.rpc('ikigai_ranked_play',{p_action:action,...args});
   if(error)throw error;
   session.data=data;
   if(session.closing)return;
   renderRankedArena(session,data);
   if(data.state==='queue'||data.state==='match'){
    session.timer=setTimeout(()=>rankedRequest(session,'poll'),900);
   }
  }catch(error){
   if(session.closing)return;
   console.error('Ranked arena:',error);
   if(error.code==='PGRST202'||error.code==='42883'){
    $('arenaRankedStatus').textContent='Máy chủ chưa cài đặt mùa giải Đấu trường.';
    return;
   }
   $('arenaRankedStatus').textContent='Kết nối gián đoạn. Đang thử lại…';
   session.timer=setTimeout(()=>rankedRequest(session,action==='join'?'join':'poll'),2000);
  }
 })();
 session.pending=operation;
 await operation;
 if(session.pending===operation)session.pending=null;
}

function renderRankedArena(session,data){
 const panel=$('arenaRankedContent');
 const key=[data.state,data.id,data.round,data.answered].join(':');
 $('arenaRankedStatus').textContent=data.state==='match'
  ?`Còn ${Math.max(0,Math.ceil((Date.parse(data.next_at)-Date.parse(data.server_time))/1000))} giây`:'';
 if(key===session.view)return;
 session.view=key;
 if(data.state==='queue'){
  panel.innerHTML='<h2>Đang tìm đối thủ…</h2><p>Ưu tiên học viên có điểm gần bạn. Tối đa 3 trận tính hạng với cùng một đối thủ mỗi ngày.</p>';
 }else if(data.state==='match'){
  panel.innerHTML=data.question
   ?`<p>${safe(data.opponent)} · Câu ${Number(data.round)+1}/20</p>
     <div class="arena-battle-question">${safe(data.question.prompt)}</div>
     <div class="arena-battle-answers">${data.question.options.map((o,i)=>`<button type="button" class="arena-answer" data-ranked-option="${i}" ${data.answered?'disabled':''}>${'ABCD'[i]}. ${safe(o)}</button>`).join('')}</div>
     <p>${data.answered?'Đã ghi nhận đáp án.':'Mỗi câu chỉ được chọn một lần.'}</p>`
   :`<h2>Chuẩn bị thi đấu</h2><p>Đối thủ · ${safe(data.opponent)}</p>`;
  panel.querySelectorAll('[data-ranked-option]').forEach(b=>b.onclick=()=>{
   panel.querySelectorAll('[data-ranked-option]').forEach(button=>button.disabled=true);
   session.view='';
   rankedRequest(session,'answer',{p_match:data.id,p_round:data.round,p_option:Number(b.dataset.rankedOption)});
  });
 }else if(data.state==='result'){
  if(Number(data.xp)>xp){xp=Number(data.xp);save()}
  const outcome=data.void?'Trận đã hủy':({draw:'Hòa',win:'Chiến thắng',lose:'Thất bại'})[data.outcome];
  panel.innerHTML=`<h2>${outcome}</h2>${data.void?'<p>Hai bên đều chưa gửi đáp án.</p>':
   `<p>Bạn ${Number(data.correct)}/20 · Đối thủ ${Number(data.opponent_correct)}/20</p>
   <p><strong>${Number(data.delta)>0?'+':''}${Number(data.delta)} điểm</strong> · Tổng ${Number(data.rating)} · +${Number(data.earned)} EXP</p>`}`;
  $('arenaRankedExit').textContent='Về sảnh';
 }else{
  panel.innerHTML=data.state==='closing'
   ?'<h2>Mùa sắp kết thúc</h2><p>Hàng chờ đóng trước giờ chốt mùa để các trận đang diễn ra có đủ thời gian hoàn thành.</p>'
   :'<h2>Hàng chờ đã hết hạn</h2><p>Về sảnh và vào lại để tìm đối thủ.</p>';
 }
}

async function closeRankedArena(session){
 if(session.closing)return;
 if(session.data?.state==='match'&&!confirm('Rời trận đang diễn ra? Kết quả vẫn được chấm khi hết giờ.'))return;
 session.closing=true;
 clearTimeout(session.timer);
 $('arenaRankedExit').disabled=true;
 try{
  await session.pending;
  const {error}=await client.rpc('ikigai_ranked_play',session.data?.state==='result'
   ?{p_action:'ack',p_match:session.data.id}
   :{p_action:'leave'});
  if(error)throw error;
 }catch(error){
  console.warn('Ranked arena exit:',error);
 }finally{
  rankedSession=null;
  $('arenaRankedOverlay')?.remove();
 }
}


const studyRooms=new Set(['class','n5','n4','jft']);
const studyGroupLabels={vocabulary:'TỪ VỰNG',grammar:'NGỮ PHÁP',kanji:'KANJI',kaiwa:'KAIWA'};
let roomQuizRequest=0;

function baseStudyQuestions(room){
 if(room==='class')return [...bank.filter(q=>['vocabulary','grammar','kanji'].includes(q.group)),...kaiwaStarter.map((q,i)=>({...q,id:'KAIWA-BASE-'+(i+1),group:'kaiwa'}))];
 return room==='n5'?bank:[];
}

async function getStudyQuestions(room){
 const defaults=baseStudyQuestions(room);
 if(!client)return [];
 try{return (await window.IKIGAI_ROOM_QUESTIONS.load(client,room,defaults)).rows}
 catch(error){
  console.warn('Room questions:',error);
  toast('Chưa tải được ngân hàng của phòng. Vui lòng thử lại.');
  return [];
 }
}

function openQuestionManager(room,trigger){
 if(!client||role!=='teacher'||user?.app_metadata?.role!=='teacher')return;
 window.IKIGAI_ROOM_QUESTIONS.open({client,room,trigger,defaults:baseStudyQuestions,escape:safe});
}
$('openQuestionManager').onclick=e=>openQuestionManager('class',e.currentTarget);

})();
