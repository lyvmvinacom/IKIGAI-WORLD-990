(()=>{'use strict';
// IKIGAI WORLD 9.1 — commercial-style overworld art integration

const SUPABASE_URL='https://vfimwlijbxamudirejiq.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_IETjbMWeJthqXscH9fkrXg_x2QZiL8D';
const ROOM='ikigai-world-members-v2';
let accountApproved=false;
window.IKIGAI_MEMBER_ACCESS=Object.freeze({isApproved:()=>accountApproved&&!!user&&!user.is_anonymous});
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
function restoreMusicToggle(){if(musicToggleNode&&musicToggleHome.parentNode)musicToggleHome.parentNode.insertBefore(musicToggleNode,musicToggleHome.nextSibling);}

let characterHair=0,characterFace=0,characterLocked=false;
let client=null,channel=null,user=null,nickname='',role='student',gender='male',avatar=0,joined=false,bank=[],currentPlace='',qset=[],qpos=0,score=0,activeGroup='',myPos={x:50,y:70},roomPos={x:50,y:70},people={},moving=false,lastSend=0,moveLoop=null,keys={},xp=0,coins=0,profileLoaded=false,realtimeStatus='DISCONNECTED',awardBusy=false,arenaMode='',arenaReady=false,arenaTimer=null,arenaMatch=null,arenaMatchTick=null,arenaMatchResults={},arenaMatchAnswers={},arenaMatchFinalized=false;
const stateKey='ikigaiWorld3Player';
const placeData={class:['Lớp học IKIGAI','Nơi học từ vựng, ngữ pháp và Kanji cùng リー先生.'],arena:['Đấu trường IKIGAI','Đấu tập kiến thức N5 với bạn bè.'],n4:['Phòng luyện thi N4','Thi thử 3 đề N4 đầy đủ: từ vựng, ngữ pháp–đọc và nghe hiểu.'],n5:['Phòng luyện thi N5','Ôn tập từ vựng, ngữ pháp, Kanji, đọc hiểu và nghe hiểu.'],jft:['Phòng luyện thi JFT A2','Chọn Thi thử để làm bài JFT-Basic A2 và xem phiếu kết quả theo từng kỹ năng.'],gym:['Phòng Văn Hoá IKIGAI','Khám phá thời gian biểu, văn hoá, phân loại rác, HORENSO và 5S.'],tea:['Phòng Trà IKIGAI','Không gian thưởng trà và giao lưu của IKIGAI. “Uống trà với anh nhé”.']};
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>$('toast').classList.remove('show'),2600)}
function save(){ $('xp').textContent=String(xp);$('coins').textContent=String(coins);$('level').textContent=String(rankLevel(xp));$('progressSource').textContent=profileLoaded?'Đồng bộ tài khoản':'Chưa đồng bộ'; }
function asset(g,a,h=0,f=0){return `assets/characters/gunny_${g==='female'?'f':'m'}_${Math.max(0,Math.min(4,Number(a)||0))}.png`}
function characterImage(g=gender,a=avatar,h=characterHair,f=characterFace){
 return asset(g,a,h,f);
}
function playerId(p){return p?.user_id||p?.id||''}
function basePlayerImage(p){return p.role==='teacher'?asset('male',0,0,0):asset(p.gender||'male',p.avatar||0,p.hair||0,p.face||0)}
function playerImage(p){return window.IKIGAI_COSMETICS?.spriteFor(playerId(p))||basePlayerImage(p)}
function portraitAttrs(p){return `data-cosmetic-user="${safe(playerId(p))}" data-base-sprite="${safe(basePlayerImage(p))}"`}
function shopStateChanged(state){
 coins=Number(state.coins);save();
 const icon=$('hudAvatar'),src=window.IKIGAI_COSMETICS?.spriteFor(user?.id);
 if(icon){icon.classList.toggle('ik-avatar-equipped',!!src);icon.innerHTML=src?`<img src="${src}" ${portraitAttrs(profile())} alt="Nhân vật đang trang bị">`:(role==='teacher'?'👨🏻‍🏫':'🌸');}
 if(channel&&joined)channel.track(profile()).catch(()=>{});
}
function updateCharacterBuilder(){
 const preview=$('avatarPreview');if(preview)preview.src=asset(gender,avatar,characterHair,characterFace);
 const grid=$('characterOptions');if(grid)grid.innerHTML=Array.from({length:5},(_,i)=>`<button type="button" data-character="${i}" class="${i===avatar?'selected':''}"><img src="${asset(gender,i,characterHair,characterFace)}" alt="Mẫu ${i+1}"><small>Mẫu ${i+1}</small></button>`).join('');
 grid?.querySelectorAll('[data-character]').forEach(b=>b.onclick=()=>{if(characterLocked)return;avatar=Number(b.dataset.character);updateCharacterBuilder()});
 const hair=$('characterHair'),face=$('characterFace');
 if(hair){hair.value='0';hair.disabled=true}if(face){face.value='0';face.disabled=true}
 const note=$('characterLockNote');if(note)note.textContent=characterLocked?'🔒 Nhân vật đã được lưu, không thể thay đổi.':'⚠️ Chỉ được tạo nhân vật một lần. Sau khi xác nhận sẽ khóa vĩnh viễn.';
}

function avatarMarkup(p,isMe=false){const img=playerImage(p);return `<div data-pet-owner="${safe(playerId(p))}" class="actor ${isMe?'me':''} ${p.role==='teacher'?'teacher':''}" data-id="${safe(p.id)}" style="left:${p.x??50}%;top:${p.y??70}%" data-direction="${safe(p.direction||'down')}"><div class="speech"></div><img src="${img}" ${portraitAttrs(p)} alt=""><div class="name">${safe(p.name||'Học viên')}</div></div>`}
function setLoginTab(tab){document.querySelectorAll('.login-tabs button').forEach(b=>b.classList.toggle('selected',b.dataset.tab===tab));$('studentForm').hidden=tab!=='student';$('teacherForm').hidden=tab!=='teacher'}
document.querySelectorAll('.login-tabs button').forEach(b=>b.onclick=()=>setLoginTab(b.dataset.tab));
document.querySelectorAll('[data-gender]').forEach(b=>b.onclick=()=>{gender=b.dataset.gender;document.querySelectorAll('[data-gender]').forEach(x=>x.classList.toggle('selected',x===b));updateAvatar()});
function updateAvatar(){updateCharacterBuilder()}
$('avatarPrev').onclick=()=>{avatar=(avatar+1)%5;updateAvatar()};$('avatarNext').onclick=()=>{avatar=(avatar+1)%5;updateAvatar()};
$('characterHair')?.addEventListener('change',e=>{if(!characterLocked){characterHair=0;updateCharacterBuilder()}});
$('characterFace')?.addEventListener('change',e=>{if(!characterLocked){characterFace=0;updateCharacterBuilder()}});
updateCharacterBuilder();
let authStorage=null;
function setup(){if(!window.supabase){$('loginStatus').textContent='Không tải được thư viện kết nối. Hãy kiểm tra Internet.';return false}const storage=$('rememberLogin')?.checked?localStorage:sessionStorage;if(client&&authStorage===storage)return true;if(client)client.auth.stopAutoRefresh();authStorage=storage;client=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,storage}});return true}
const authKey='sb-vfimwlijbxamudirejiq-auth-token';
function expiredAuth(e){return /refresh_token_not_found|refresh_token_already_used|session_not_found|bad_jwt|AuthSessionMissingError|invalid refresh token|refresh token.*(not found|already used|expired)|session.*(missing|not found|expired)|jwt expired/i.test([e?.code,e?.name,e?.message].join(' '))}
function networkAuth(e){return /fetch|network|timeout|timed out|connection|load failed|offline|AuthRetryableFetchError/i.test([e?.name,e?.message].join(' '))||e?.status>=500||navigator.onLine===false}
function clearExpiredAuth(){try{authStorage?.removeItem(authKey)}catch(_){} }

async function studentAuth(signup){
 const email=$('studentEmail').value.trim(),password=$('studentPassword').value;nickname=$('studentName').value.trim();
 if((signup&&!nickname)||!email||password.length<6){$('loginStatus').textContent='Nhập tên, email và mật khẩu từ 6 ký tự trở lên.';return}
 if(!setup())return;setBusy(true);
 try{
  if(signup){
   const {data,error}=await client.auth.signUp({email,password,options:{data:{nickname,role:'student',gender,avatar,hair:characterHair,face:characterFace}}});if(error)throw error;
   if(data.session)await client.auth.signOut();user=null;accountApproved=false;
   $('studentPassword').value='';$('loginStatus').textContent='Đã gửi yêu cầu đăng ký. Vui lòng chờ giáo viên phê duyệt trước khi đăng nhập vào học. Nếu có email xác nhận, hãy xác nhận email trước.';return;
  }
  const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;user=data.user;
  nickname=user.user_metadata?.nickname||nickname||email.split('@')[0];gender=user.user_metadata?.gender||gender;avatar=Number(user.user_metadata?.avatar||0);characterHair=Number(user.user_metadata?.hair||0);characterFace=Number(user.user_metadata?.face||0);role='student';await enterWorld();
 }catch(e){$('loginStatus').textContent=translateError(e)}finally{setBusy(false)}
}
function translateError(e){const s=typeof e==='string'?e:e?.message||'Lỗi không xác định';if(networkAuth(e)||/fetch|network|timeout|load failed/i.test(s))return 'Kết nối không ổn định. Kiểm tra Internet rồi thử lại.';if(expiredAuth(e))return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';if(/Invalid login credentials/i.test(s))return 'Tài khoản hoặc mật khẩu chưa đúng.';if(/already registered/i.test(s))return 'Email này đã có tài khoản. Hãy chọn Đăng nhập.';if(/Email not confirmed/i.test(s))return 'Email chưa được xác nhận. Hãy kiểm tra hộp thư.';return s}
function setBusy(v){$('studentSignIn').disabled=v;$('studentSignUp').disabled=v;$('teacherSignIn').disabled=v}
async function teacherAuth(){const email=window.IKIGAI_TEACHER_LOGIN.email($('teacherEmail').value),password=$('teacherPassword').value;if(!email||!password){$('loginStatus').textContent='Nhập ID hoặc email và mật khẩu giáo viên.';return}if(!setup())return;setBusy(true);try{const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;if(data.user.app_metadata?.role!=='teacher'){await client.auth.signOut();throw new Error('Tài khoản chưa được cấp quyền teacher trong Supabase.')}user=data.user;role='teacher';nickname=window.IKIGAI_TEACHER_LOGIN.displayName(user);gender='male';avatar=0;await enterWorld()}catch(e){$('loginStatus').textContent=translateError(e);setBusy(false)}}
$('studentSignIn').onclick=()=>studentAuth(false);$('studentSignUp').onclick=()=>studentAuth(true);$('teacherSignIn').onclick=teacherAuth;
async function enterWorld(){
 if(!user)throw Error('Chưa xác thực tài khoản');
 accountApproved=false;
 const {data:access,error:accessError}=await client.rpc('ikigai_account_status');if(accessError)throw accessError;
 if(!access?.allowed){const message=access?.status==='rejected'?'Yêu cầu đăng ký chưa được giáo viên chấp nhận. Vui lòng liên hệ giáo viên.':access?.status==='guest_disabled'?'IKIGAI không còn hỗ trợ chế độ khách. Vui lòng đăng ký và chờ phê duyệt.':'Tài khoản đang chờ giáo viên phê duyệt. Bạn chưa thể vào học.';await client.auth.signOut();user=null;throw Error(message)}
 accountApproved=true;role=access.teacher?'teacher':'student';if(access.teacher){nickname=window.IKIGAI_TEACHER_LOGIN.displayName(user);gender='male';avatar=0}
 localStorage.setItem('ikigaiRememberLogin',String(!!$('rememberLogin')?.checked));$('login').hidden=true;$('openQuestionManager').hidden=role!=='teacher';window.IKIGAI_AUDIO?.play('map');$('hudName').textContent=nickname;$('hudRole').textContent=role==='teacher'?'GIÁO VIÊN · '+nickname:role==='guest'?'KHÁCH · PHIÊN TẠM':'HỌC VIÊN IKIGAI';$('hudAvatar').textContent=role==='teacher'?'👨🏻‍🏫':'🌸';await loadPlayerProfile();await window.IKIGAI_COSMETICS?.init({context:()=>({client,user,role,profileLoaded,nickname}),onState:shopStateChanged,onError:toast});save();window.IKIGAI_APPROVALS?.init(()=>({client,user,role}));window.IKIGAI_EXAM_HISTORY?.init(()=>({client,user,role}));window.IKIGAI_DIARY?.init(()=>({client,user,role,place:$('roomScene').hidden?'map':currentPlace}));await connectRealtime();renderMembers();await loadBank();renderActors();try{await window.IKIGAI_TASKS?.init(()=>({client,user,role}),place=>{if(!$('roomScene').hidden)backMap();enterPlace(place);});}catch(taskError){console.warn('Task initialization:',taskError);}toast('🌸 Chào mừng '+nickname+' đến IKIGAI WORLD!')}
async function connectRealtime(){if(channel){try{await client.removeChannel(channel)}catch(e){}}joined=false;realtimeStatus='CONNECTING';renderMembers();channel=client.channel(ROOM,{config:{private:true,presence:{key:user.id},broadcast:{self:false}}});
channel.on('presence',{event:'sync'},()=>{const state=channel.presenceState();people=Object.create(null);Object.values(state).flat().forEach(p=>{if(p.user_id&&p.user_id!==user.id)people[p.user_id]=p});renderActors();renderMembers();if(!$('roomScene').hidden){renderRoomPeers();}updateArenaLobby()});
channel.on('broadcast',{event:'position'},({payload})=>{if(!payload||payload.user_id===user.id)return;const p=people[payload.user_id]||{};Object.assign(p,payload);people[payload.user_id]=p;updateActor(payload);renderMembers()});
channel.on('broadcast',{event:'chat'},({payload})=>{if(payload?.user_id!==user.id){const scene=$('roomScene').hidden?'map':'room';if(payload?.scene===scene&&(scene!=='room'||payload?.place===currentPlace)){addMessage(payload.name,payload.text,payload.role==='teacher');if(scene==='room')showBubble(payload.user_id,payload.text)}}});
channel.on('broadcast',{event:'bubble'},({payload})=>{if(payload?.user_id!==user.id)showBubble(payload.user_id,payload.text)});
channel.on('broadcast',{event:'arena-match'},({payload})=>handleArenaMatchEvent(payload));
channel.on('broadcast',{event:'scene'},({payload})=>{if(payload?.user_id!==user.id&&payload?.scene==='room')toast(`${payload.name} đã vào ${placeData[payload.place]?.[0]||'một phòng'}`)});
const status=await new Promise(resolve=>{const timer=setTimeout(()=>resolve('TIMEOUT'),10000);channel.subscribe(async s=>{if(s==='SUBSCRIBED'){clearTimeout(timer);joined=true;realtimeStatus=s;renderMembers();await channel.track(profile());$('connectionStatus')?.classList.add('connected');resolve(s)}else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'||s==='CLOSED'){clearTimeout(timer);joined=false;realtimeStatus=s;renderMembers();resolve(s)}})});
if(status!=='SUBSCRIBED'){joined=false;realtimeStatus=status;renderMembers();}if(status!=='SUBSCRIBED')toast('Chưa kết nối được máy chủ nhiều người chơi. Bạn vẫn có thể học cục bộ.');}
function profile(){return {user_id:user.id,id:user.id,name:nickname,role:role==='teacher'?'teacher':role==='guest'?'guest':'student',gender,avatar,hair:characterHair,face:characterFace,x:myPos.x,y:myPos.y,moving:!!myPos.moving,direction:myPos.direction||'down',scene:$('roomScene').hidden?'map':'room',place:currentPlace||'map',roomX:roomPos.x,roomY:roomPos.y,xp:Number(xp||0),level:rankLevel(xp),online_at:new Date().toISOString()}}
async function loadPlayerProfile(){xp=0;coins=0;profileLoaded=false;if(role==='guest'){save();return}try{const {data,error}=await client.rpc('ikigai_ensure_profile',{p_nickname:nickname,p_gender:gender,p_avatar:avatar,p_hair:characterHair,p_face:characterFace});if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(row){nickname=row.nickname||nickname;gender=row.gender||gender;avatar=Number(row.avatar||0);characterHair=Number(row.hair||0);characterFace=Number(row.face||0);characterLocked=!!row.character_locked;updateCharacterBuilder();xp=Number(row.xp||0);coins=Number(row.coins||0)}profileLoaded=true;$('hudName').textContent=nickname;save()}catch(e){console.error('Profile sync:',e);toast('Chưa đồng bộ được hồ sơ/XP. Hãy kiểm tra migration Supabase IKIGAI 10.5.7.');save()}}
let awardSet=null,awardAttempt=null,lastQuizCoins=0,lastQuizXp=0,quizRewardRoom='',quizRewardGroup='',quizRewardLesson=null;
window.IKIGAI_REWARDS={rpc:async(name,args)=>{
 if(!client||!user||role!=='student'||user.is_anonymous||!profileLoaded)return {guest:true};
 const {data,error}=await client.rpc(name,args);if(error)throw error;
 if(Number.isInteger(data?.coins_total)){coins=data.coins_total;if(Number.isInteger(data.xp_total))xp=data.xp_total;save();if(channel&&joined)channel.track(profile()).catch(()=>{});}
 return data;
}};
async function persistAward(){if(role==='guest'||!profileLoaded||awardBusy)return false;awardBusy=true;try{if(awardSet!==qset){awardSet=qset;awardAttempt=crypto.randomUUID();}const {data,error}=await client.rpc('ikigai_room_quiz_finish',{p_room:quizRewardRoom,p_group:quizRewardGroup,p_lesson:quizRewardLesson,p_correct:score,p_total:qset.length,p_attempt_id:awardAttempt});if(error)throw error;xp=Number(data?.xp??xp);coins=Number(data?.coins??coins);lastQuizCoins=Number(data?.coins_awarded||0);lastQuizXp=Number(data?.xp_awarded||0);save();window.IKIGAI_TASKS?.refresh(true);if(channel&&joined)await channel.track(profile());if(currentPlace==='class')renderClassLeaderboard();return true}catch(e){console.error('Award sync:',e);toast('Kết quả đã chấm nhưng chưa cộng thưởng lên tài khoản. Cần kiểm tra RPC Supabase.');return false}finally{awardBusy=false}}
function renderActors(){/* Gunny-style: map is scenery only; sprites appear after entering a room. */$('mapActors').innerHTML='';updateOnlineSummary()}
function bindActorClicks(){document.querySelectorAll('.actor').forEach(el=>el.onclick=()=>{const id=el.dataset.id;if(id===user.id){toast('Đây là nhân vật của bạn.');return}const p=people[id];if(p){showBubble(id,'こんにちは '+nickname+'! 一緒に勉強しよう！');sendBubble(id,'こんにちは! 👋')}})}
function updateActor(p){const el=document.querySelector(`.actor[data-id="${CSS.escape(p.user_id)}"]`);if(el){el.style.left=p.x+'%';el.style.top=p.y+'%';el.classList.toggle('walking',!!p.moving);if(p.direction)el.dataset.direction=p.direction;if(p.gender||p.avatar!==undefined){const img=el.querySelector('img');img.src=playerImage(p)}}const re=$('roomScene').querySelector(`.room-actor[data-id="${CSS.escape(p.user_id)}"]`);if(re){re.style.left=(p.roomX||50)+'%';re.style.top=(p.roomY||70)+'%';if(currentPlace==='gym'){re.style.setProperty('--culture-depth',cultureDepth(p.roomY??70));re.style.zIndex=Math.round(Number(p.roomY??70));re.classList.toggle('walking',!!p.moving);if(p.direction)re.dataset.direction=p.direction}}else if(!$('roomScene').hidden&&p.scene==='room'&&p.place===currentPlace){if(currentPlace==='arena'){const peer=$('arenaPeerStage')?.querySelector(`.arena-live-player[data-player-id="${CSS.escape(p.user_id)}"]`);if(peer){peer.style.left=(p.roomX??50)+'%';peer.style.top=(p.roomY??72)+'%';peer.classList.toggle('walking',!!p.moving);if(p.direction){peer.dataset.direction=p.direction;arenaFacing(peer,p.direction)}}else renderArenaLobbyPeers()}else renderRoomPeers()}if(!el&&$('roomScene').hidden)renderActors()}
function onlineRoster(){
 if(!user||!joined)return [];
 const users=new Map();
 for(const p of Object.values(people)){if(p?.user_id&&p.user_id!==user.id)users.set(p.user_id,p)}
 users.set(user.id,{...profile(),isMe:true});
 return [...users.values()].sort((a,b)=>Number(!!b.isMe)-Number(!!a.isMe)||Number(b.role==='teacher')-Number(a.role==='teacher')||String(a.name||'').localeCompare(String(b.name||''),'vi'));
}
function updateOnlineSummary(){const count=onlineRoster().length;$('onlineCount').textContent=joined?String(count):'—';$('memberCount').textContent=String(count);$('onlineToggle').title=joined?`${count} người đang online · Bấm để xem danh sách`:'Chưa kết nối danh sách online';}
let memberMarkup='';
function renderMembers(){
 updateOnlineSummary();
 $('onlineStatus').textContent=joined?'Cập nhật trực tiếp · Tính theo người, không theo số tab.':realtimeStatus==='CONNECTING'?'Đang kết nối danh sách online…':'Chưa kết nối máy chủ. Danh sách sẽ cập nhật khi kết nối lại.';
 const markup=onlineRoster().map(p=>{const location=p.scene==='room'?(placeData[p.place]?.[0]||'Trong phòng'):'Bản đồ';const label=p.role==='teacher'?'Giáo viên':p.role==='guest'?'Khách':'Học viên';return `<div class="member-row"><img src="${playerImage(p)}" ${portraitAttrs(p)} alt=""><span><b>${safe(p.name||'Học viên')}${p.isMe?' <small class="online-self">(Bạn)</small>':''}</b><small>${label} · ${safe(location)}</small></span><i class="online-dot" aria-label="Đang online"></i></div>`}).join('');
 if(markup!==memberMarkup){$('members').innerHTML=markup;memberMarkup=markup;}
}
function closeMembers(returnFocus=false){$('memberbox').classList.remove('open');$('onlineToggle').setAttribute('aria-expanded','false');if(returnFocus)$('onlineToggle').focus();}
let settingsTrigger=null;
function closeSettings(returnFocus=false){$('mapSettings').hidden=true;document.querySelectorAll('[aria-controls="mapSettings"]').forEach(n=>n.setAttribute('aria-expanded','false'));if(returnFocus&&settingsTrigger?.isConnected)settingsTrigger.focus();}
function toggleSettings(trigger){
 const opening=$('mapSettings').hidden||settingsTrigger!==trigger;
 closeSettings();closeMembers();$('chatbox').classList.remove('open');
 if(!opening)return;
 settingsTrigger=trigger;const inRoom=!$('roomScene').hidden;
 $('settingsTitle').textContent=inRoom?'🗺️ Bản đồ & nhạc':'⚙️ Cài đặt';
 $('mapSettings').dataset.mode=inRoom?'room':'map';
 $('logoutBtn').hidden=inRoom;$('settingsBackMap').hidden=!inRoom;
 restoreMusicToggle();$('mapSettings').hidden=false;
 trigger.setAttribute('aria-expanded','true');$('musicToggle').focus();
}
function openMembers(){closeSettings();$('chatbox').classList.remove('open');renderMembers();$('memberbox').classList.add('open');$('onlineToggle').setAttribute('aria-expanded','true');$('closeMembers').focus();}
$('onlineToggle').onclick=()=>{$('memberbox').classList.contains('open')?closeMembers():openMembers()};
$('settingsToggle').onclick=()=>toggleSettings($('settingsToggle'));
$('settingsBackMap').onclick=()=>backMap();
$('closeSettings').onclick=()=>closeSettings(true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('mapSettings').hidden)closeSettings(true);else if($('memberbox').classList.contains('open'))closeMembers(true)}});
document.addEventListener('click',e=>{if(!e.target.closest('#mapSettings,[aria-controls="mapSettings"]'))closeSettings();if(!e.target.closest('#memberbox,#onlineToggle'))closeMembers();},true);

function addMessage(name,text,teacher=false){const d=document.createElement('div');d.className='message';d.innerHTML=`<b>${safe(name)}</b><small>${new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</small><br>${safe(text)}`;$('messages').appendChild(d);$('messages').scrollTop=$('messages').scrollHeight}
function sendChat(text){text=text.trim();if(!text)return;addMessage(nickname,text,role==='teacher');if(!$('roomScene').hidden)showBubble('me',text);if(channel&&joined)channel.send({type:'broadcast',event:'chat',payload:{user_id:user.id,name:nickname,text,role,scene:$('roomScene').hidden?'map':'room',place:currentPlace||'map'}})}
$('chatForm').onsubmit=e=>{e.preventDefault();sendChat($('chatInput').value);$('chatInput').value='';$('chatInput').blur()};

$('chatToggle').onclick=()=>$('chatbox').classList.toggle('open');$('closeChat').onclick=()=>$('chatbox').classList.remove('open');$('closeMembers').onclick=()=>closeMembers(true);
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
 if(el){el.style.left=roomPos.x+'%';el.style.top=roomPos.y+'%';el.classList.add('walking');el.dataset.direction=myPos.direction;arenaFacing(el,myPos.direction);el.style.setProperty('--arena-depth',String(.84+(roomPos.y-51)*.008))}
 sendPosition();
}
function move(dir){const [dx,dy]=dirs[dir]||[0,0];if($('roomScene').hidden){myPos.x=Math.max(4,Math.min(96,myPos.x+dx));myPos.y=Math.max(12,Math.min(94,myPos.y+dy));myPos.direction=dir;myPos.moving=true;const el=document.querySelector('.actor.me');if(el){el.style.left=myPos.x+'%';el.style.top=myPos.y+'%';el.classList.add('walking');el.dataset.direction=dir;clearTimeout(el.walkTimer);el.walkTimer=setTimeout(()=>el.classList.remove('walking'),220)}}else if(currentPlace==='arena'){moveArenaVector(dx,dy,1);return}else{roomPos.x=Math.max(currentPlace==='gym'?12:4,Math.min(currentPlace==='gym'?76:96,roomPos.x+dx*1.5));roomPos.y=Math.max(currentPlace==='gym'?52:10,Math.min(88,roomPos.y+dy*1.5));myPos.direction=dir;myPos.moving=true;const el=$('roomScene').querySelector('.room-actor.me');if(el){el.style.left=roomPos.x+'%';el.style.top=roomPos.y+'%';if(currentPlace==='gym'){el.style.setProperty('--culture-depth',cultureDepth(roomPos.y));el.style.zIndex=Math.round(roomPos.y)}el.classList.add('walking');el.dataset.direction=dir;clearTimeout(el.walkTimer);el.walkTimer=setTimeout(()=>el.classList.remove('walking'),220)}}sendPosition()}
function sendPosition(isMoving=true,force=false){if(!channel||!joined||(!force&&Date.now()-lastSend<70))return;lastSend=Date.now();channel.send({type:'broadcast',event:'position',payload:{user_id:user.id,name:nickname,role,gender,avatar,hair:characterHair,face:characterFace,x:myPos.x,y:myPos.y,roomX:roomPos.x,roomY:roomPos.y,scene:$('roomScene').hidden?'map':'room',place:currentPlace,moving:!!isMoving,direction:myPos.direction||'down'}});if(!isMoving)channel.track(profile())}
document.addEventListener('keydown',e=>{if(!$('jftPractice').hidden||['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;const map={ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'};if(map[e.key]){e.preventDefault();if(!keys[e.key])move(map[e.key]);keys[e.key]=true}});
document.addEventListener('keyup',e=>{keys[e.key]=false;if(!Object.values(keys).some(Boolean)){const el=document.querySelector('.actor.me,.room-actor.me');el?.classList.remove('walking');if(myPos.moving){myPos.moving=false;sendPosition(false,true)}}});window.addEventListener('blur',()=>{keys={};document.querySelectorAll('.actor.me,.room-actor.me').forEach(el=>el.classList.remove('walking'));myPos.moving=false;sendPosition()});
document.querySelectorAll('#roomScene [data-dir]').forEach(b=>{const d=b.dataset.dir;const start=e=>{e.preventDefault();move(d);clearInterval(b.repeat);b.repeat=setInterval(()=>move(d),90)};const end=()=>clearInterval(b.repeat);b.addEventListener('pointerdown',start);['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,end))});
function showPlace(p){currentPlace=p;$('placeTitle').textContent=placeData[p][0];$('placeDescription').textContent=placeData[p][1];$('placeModal').hidden=false}
document.querySelectorAll('.hotspot').forEach(b=>b.onclick=()=>showPlace(b.dataset.place));$('closePlace').onclick=()=>$('placeModal').hidden=true;$('enterPlace').onclick=()=>{ $('placeModal').hidden=true;enterPlace(currentPlace)};
function cultureDepth(y){return .48+.52*Math.max(0,Math.min(1,(Number(y)-52)/36))}
function arenaFacing(el,dir){if(dir==='left'||dir==='right')el.dataset.facing=dir}
function roomCharacter(p,id='me',name=nickname,roleValue=role,genderValue=gender,avatarValue=avatar){const person={user_id:id==='me'?user?.id:id,role:roleValue,gender:genderValue,avatar:avatarValue,hair:id==='me'?characterHair:0,face:id==='me'?characterFace:0};const img=playerImage(person);const staticNpc=id==='teacher-npc';const isPeer=id!=='me'&&!staticNpc;return `<div data-pet-owner="${staticNpc?'':safe(playerId(person))}" class="room-actor ${id==='me'?'me':''} ${roleValue==='teacher'?'teacher-actor':''} ${staticNpc?'static-npc':''}" data-id="${safe(id)}" ${isPeer?'data-peer="true"':''} style="left:${p.x??50}%;top:${p.y??70}%;${currentPlace==='gym'?`--culture-depth:${cultureDepth(p.y??70)};z-index:${Math.round(Number(p.y??70))}`:''}" data-direction="${safe(p.direction||'down')}"><div class="speech"></div><img src="${img}" ${staticNpc?'':portraitAttrs(person)}><span>${safe(name)}</span></div>`}
function roomStations(keys){const labels={vocabulary:['📖','TỪ VỰNG'],grammar:['📝','NGỮ PHÁP'],kanji:['🈶','KANJI'],hyogen:['💬','HYŌGEN'],reading:['📄','ĐỌC HIỂU'],listening:['🎧','NGHE HIỂU'],mock:['🏆','THI THỬ']};return `<div class="station-grid">${keys.map(k=>`<button class="station" data-action="${k}"><span>${labels[k][0]}</span>${labels[k][1]}</button>`).join('')}</div>`}
function roomFloatingNav(p){
const sets={
class:[['vocabulary','📖','Từ vựng'],['grammar','📝','Ngữ pháp'],['kanji','漢','Kanji'],['kaiwa','💬','Kaiwa'],['listening','🎧','Nghe hiểu']],
n5:[['vocabulary','📖','Từ vựng'],['grammar','📝','Ngữ pháp'],['kanji','漢','Kanji'],['listening','🎧','Nghe hiểu'],['mock','🏆','Thi thử']],
n4:[['vocabulary','📖','Từ vựng'],['grammar','📝','Ngữ pháp'],['listening','🎧','Nghe hiểu'],['mock','🏆','Thi thử']],
jft:[['kanji','漢','Kanji'],['vocabulary','📖','Từ vựng'],['hyogen','💬','Hyōgen']],
arena:[['duel','⚔️','Đấu tập'],['rules','📜','Luật chơi']],
gym:[['culture-schedule','◷','Thời gian biểu'],['culture-values','∞','Văn hoá IKIGAI'],['culture-trash','♻','Phân loại rác'],['culture-horenso','💬','HORENSO'],['culture-five','✦','5S']],
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
// Inclusive upper bounds agreed for levels 1–9; level 10 starts at 85,001.
const rankUpperBounds=[5000,10000,17000,25000,35000,46000,58000,71000,85000,100000];
function rankLevel(value){const n=Math.max(0,Math.floor(Number(value)||0));const i=rankUpperBounds.slice(0,9).findIndex(limit=>n<=limit);return i<0?10:i+1}
function rankProgress(value){const n=Math.max(0,Math.floor(Number(value)||0)),level=rankLevel(n),start=level===1?0:rankUpperBounds[level-2],end=rankUpperBounds[level-1];return {level,percent:Math.max(0,Math.min(100,(n-start)/(end-start)*100)),remaining:Math.max(0,(level===10?end:end+1)-n)}}
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

function enterPlace(p){window.IKIGAI_DIARY?.study(null);closeSettings();closeMembers();roomQuizRequest++;window.IKIGAI_AUDIO?.play(p);currentPlace=p;$('mapScene').hidden=true;$('roomScene').hidden=false;let title='',inside='';
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
     <button type="button" class="classroom-function-btn" data-action="kanji" aria-label="Gỡ bom Kanji">💣 Kanji</button>
     <button type="button" class="classroom-function-btn" data-action="kaiwa" aria-label="Kaiwa">Kaiwa</button>
     <button type="button" class="classroom-function-btn" data-action="listening" aria-label="Nghe hiểu">Nghe hiểu</button>
   </nav><button type="button" data-action="bunpou" style="position:absolute;z-index:81;left:78.4%;top:71%;width:16.6%;min-height:8%;padding:3px;background:#873c50;color:#fff4d1;border:2px solid #e4bd78;border-radius:12px;font-size:clamp(9px,1.4vw,17px);font-weight:900;pointer-events:auto;cursor:pointer">🧩 BUNPOU TETRIS</button>
 </div>`;
}
if(p==='n5'){title='PHÒNG LUYỆN THI N5';inside=`${decor}<div class="exam-room-art n5-art"><div class="banner">🌸 N5 · KHU LUYỆN THI CƠ BẢN</div><div class="exam-window">富士山 · SAKURA</div><div class="exam-podium">N5<small>日本語能力試験</small></div><div class="exam-bookcase">📚 📚 📚<small>GIÁO TRÌNH N5</small></div><div class="exam-headphones">🎧<small>NGHE HIỂU</small></div><div class="exam-scroll">ひらがな · カタカナ · 漢字</div><div class="room-actors">${roomCharacter(roomPos,'me')}</div>${roomStations(['vocabulary','grammar','kanji','reading','listening','mock'])}`}
if(p==='n4'||p==='jft'){title=p==='n4'?'PHÒNG LUYỆN THI N4':'PHÒNG LUYỆN THI JFT A2';inside=`${decor}<div class="exam-room-art advanced-art"><div class="banner">${p==='n4'?'🏯 N4 · THỬ THÁCH TRUNG CẤP':'🎌 JFT-BASIC A2 · EXAM HALL'}</div><div class="exam-window">日本語 · CHALLENGE</div><div class="exam-podium">${p==='n4'?'N4':'A2'}<small>${p==='n4'?'日本語能力試験':'JFT-BASIC'}</small></div><div class="exam-bookcase">📚 📚 📚<small>THƯ VIỆN ĐỀ THI</small></div><div class="exam-headphones">🎧<small>LISTENING LAB</small></div><div class="exam-scroll">読む · 聞く · 書く · 話す</div><div class="room-actors">${roomCharacter(roomPos,'me')}</div>${roomStations(p==='jft'?['kanji','vocabulary','hyogen']:['vocabulary','grammar','kanji','reading','listening','mock'])}`}
if(p==='arena'){roomPos.x=48;roomPos.y=66;title='ĐẤU TRƯỜNG IKIGAI';inside=`<div class="arena-lobby-stage" aria-label="Sảnh Đấu Trường IKIGAI">
 <img class="arena-lobby-art" src="assets/ikigai-arena-background-title.png?v=10.3.5" alt="" aria-hidden="true" draggable="false">
 <header class="arena-topbar">
  <div class="arena-brand"><b>IKIGAI</b><small>WORLD · BATTLE ARENA</small></div>
  <div class="arena-player-profile"><img src="${playerImage(profile())}" ${portraitAttrs(profile())} alt=""><span><b>${safe(nickname)}</b><small>Lv.${rankLevel(xp)} · ${safe(role==='teacher'?'Giáo viên':'Học viên')}</small></span></div>
  <div class="arena-wallet"><span>⭐ ${Number(coins||0).toLocaleString('vi-VN')}</span><span>✦ ${Number(xp||0).toLocaleString('vi-VN')} XP</span></div>
  <button class="arena-back" data-arena-ui="back" aria-controls="mapSettings" aria-expanded="false" type="button">🗺️ Bản đồ ▾</button>
 </header>

 <div class="arena-live-layout">
  <aside class="arena-chat-card">
   <button class="arena-panel-heading" id="arenaChatExpand" type="button" aria-expanded="false"><span>💬 PHÒNG CHAT</span><i>LIVE</i></button>
   <div class="arena-online-count" id="arenaOnlineCount">Đang kết nối người chơi…</div>
  </aside>
  <section class="arena-stage-center">
   <div class="arena-fire-ring" aria-hidden="true"><i></i><i></i><i></i></div>
   <div class="arena-peer-stage" id="arenaPeerStage">
    <div class="arena-live-player arena-self">
     <img src="${playerImage(profile())}" ${portraitAttrs(profile())} alt="Nhân vật của bạn">
     <span class="arena-player-name">${safe(nickname)}</span><small>Lv.${rankLevel(xp)} · Bạn</small>
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
if(p==='gym'){roomPos.x=50;roomPos.y=76;title='PHÒNG VĂN HOÁ IKIGAI';inside=`<div class="room-actors">${roomCharacter(roomPos,'me')}</div><div id="cultureJoystick" class="culture-joystick" role="group" aria-label="Joystick di chuyển"><b class="cj-up">▲</b><b class="cj-right">▶</b><b class="cj-down">▼</b><b class="cj-left">◀</b><i id="cultureJoystickThumb"></i></div>`}
if(p==='tea'){title='PHÒNG TRÀ';inside=`<div class="room-actors">${roomCharacter(roomPos,'me')}</div>`}
$('roomScene').innerHTML=`<header class="room-top ${['n4','n5','gym'].includes(p)?'room-top-toolbar':''} ${p==='class'?'room-top-class':''} ${p==='tea'?'room-top-tea':p==='jft'?'room-top-jft':p==='n4'?'room-top-n4':''}">${p==='class'?'':p==='tea'?'<strong>PHÒNG TRÀ</strong>':`<strong>${title}</strong>`}<div class="room-top-actions">${['n4','n5','gym'].includes(p)?'':''}${p==='n4'?'<button type="button" id="n4KanjiLaunch" data-action="kanji">漢 Kanji</button><button type="button" id="n4RoomLaunch" data-action="mock">🏆 Thi thử N4</button>':''}${p==='n5'?'<button type="button" id="n5RoomLaunch" data-action="mock">🏆 Thi thử N5</button>':''}${p==='jft'?'<button type="button" id="jftRoomLaunch" data-action="mock">🏆 Thi thử JFT</button>':''}${role==='teacher'&&studyRooms.has(p)?'<button type="button" id="roomQuestionManager">📚 Nạp / sửa</button>':''}${role==='teacher'&&['n5','n4','jft'].includes(p)?'<button type="button" id="roomExamHistory">Lịch sử thi</button>':''}<button id="roomChatToggle">💬 CHAT</button><button id="backMap">↩ VỀ BẢN ĐỒ</button></div>${p==='jft'?'<nav class="jft-skill-nav" aria-label="Luyện tập JFT A2"><button data-action="kanji">漢 Kanji</button><button data-action="vocabulary">📖 Từ vựng</button><button data-action="hyogen">💬 Hyōgen</button></nav>':''}</header><div class="interior interior-${p}">${inside}${p==='class'||p==='tea'?'':`<div class="room-controls"><button data-dir="up">↑</button><button data-dir="left">←</button><button data-dir="down">↓</button><button data-dir="right">→</button></div>${p==='jft'?'':roomFloatingNav(p)}`}</div>`;
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
}
if(p==='gym'){
 const joy=$('cultureJoystick'),thumb=$('cultureJoystickThumb');let pointer=null,timer=null,dir=null;
 const stop=()=>{if(timer!==null)clearInterval(timer);timer=null;pointer=null;dir=null;thumb.style.transform='translate(-50%,-50%)';joy.classList.remove('active');if(myPos.moving){myPos.moving=false;sendPosition(false,true)}};
 const update=e=>{const r=joy.getBoundingClientRect(),sx=e.clientX-r.left-r.width/2,sy=e.clientY-r.top-r.height/2,rot=window.matchMedia('(orientation: portrait) and (max-width: 900px)').matches,x=rot?sy:sx,y=rot?-sx:sy,mag=Math.hypot(x,y),radius=Math.min(r.width,r.height)*.28;if(mag<7){dir=null;thumb.style.transform='translate(-50%,-50%)';if(myPos.moving){myPos.moving=false;sendPosition(false,true)}return}const k=Math.min(radius,mag)/mag;thumb.style.transform='translate(calc(-50% + '+x*k+'px),calc(-50% + '+y*k+'px))';dir=Math.abs(x)>Math.abs(y)?(x>0?'right':'left'):(y>0?'down':'up');};
 joy.addEventListener('pointerdown',e=>{if(pointer!==null)return;e.preventDefault();pointer=e.pointerId;joy.setPointerCapture?.(pointer);joy.classList.add('active');update(e);if(dir)move(dir);timer=setInterval(()=>{if(currentPlace!=='gym'||$('roomScene').hidden||!joy.isConnected){stop();return}if(dir)move(dir)},75)});
 joy.addEventListener('pointermove',e=>{if(e.pointerId===pointer)update(e)});joy.addEventListener('pointerup',e=>{if(e.pointerId===pointer)stop()});joy.addEventListener('pointercancel',stop);joy.addEventListener('lostpointercapture',stop);
}
restoreMusicToggle();
$('roomQuestionManager')?.addEventListener('click',e=>openQuestionManager(p,e.currentTarget));
$('roomExamHistory')?.addEventListener('click',e=>window.IKIGAI_EXAM_HISTORY?.open(p,e.currentTarget));
$('backMap').textContent='🗺️ BẢN ĐỒ ▾';$('backMap').setAttribute('aria-controls','mapSettings');$('backMap').setAttribute('aria-expanded','false');$('backMap').onclick=()=>toggleSettings($('backMap'));$('roomScene').querySelector('[data-nav-back]')?.addEventListener('click',backMap);$('roomChatToggle').onclick=()=>{if(currentPlace==='arena'){ $('arenaChatExpand')?.click();return }$('chatbox').classList.toggle('open');$('chatInput').focus()};$('roomScene').querySelector('[data-npc="tung"]')?.addEventListener('click',()=>toast('Giám đốc: Ngồi xuống, cầm chén trà bằng hai tay nhé!'));
$('roomScene').querySelectorAll('.room-actor').forEach(el=>el.onclick=()=>{const id=el.dataset.id;if(id==='me')toast('Đây là nhân vật của bạn!');else{const p=people[id];if(p){if(channel&&joined)channel.send({type:'broadcast',event:'bubble',payload:{user_id:user.id,target:id,text:'Xin chào! Cùng học nhé!'}});toast('Đã gửi lời chào đến '+p.name)}}});$('roomScene').querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>roomAction(b.dataset.action,b));
$('roomScene').querySelectorAll('[data-arena-ui]').forEach(b=>b.addEventListener('click',()=>{
 const action=b.dataset.arenaUi;
 if(action==='chat'){$('chatbox').classList.toggle('open');$('chatInput')?.focus();return}
 if(action==='back'){toggleSettings(b);return}
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
 const self={user_id:user?.id,name:nickname,role,gender,avatar,hair:characterHair,face:characterFace,xp,direction:myPos.direction};
 const peers=Object.values(people).filter(p=>p.user_id!==user?.id&&p.scene==='room'&&p.place==='arena');
 const all=[self,...peers].slice(0,5);const facing=new Map([...host.querySelectorAll('.arena-live-player')].map(el=>[el.dataset.playerId,el.dataset.facing]));
 host.innerHTML=all.map((p,i)=>{
  const level=rankLevel(p.xp||0),rank=classRanks[level-1]||classRanks[0];
  const avatarSrc=playerImage(p);
  const px=i===0?(roomPos.x??50):(p.roomX??50),py=i===0?(roomPos.y??72):(p.roomY??72);
  return `<div data-pet-owner="${safe(playerId(p))}" class="arena-live-player ${i===0?'arena-self':'arena-peer'}" data-player-id="${safe(p.user_id||user?.id||'self')}" data-facing="${p.direction==='left'||p.direction==='right'?p.direction:(facing.get(p.user_id||user?.id||'self')||'right')}" style="left:${Math.max(4,Math.min(96,px))}%;top:${Math.max(8,Math.min(94,py))}%">
   <div class="arena-player-overhead">
    <span class="arena-player-name">${safe(p.name||'Học viên')}</span>
    <span class="arena-player-title"><b>${rank.icon}</b> ${safe(rank.name)}</span>
    <small>Lv.${level}${i===0?' · Bạn':''}</small>
   </div>
   <img src="${avatarSrc}" ${portraitAttrs(p)} alt="${safe(p.name||'Nhân vật')}" draggable="false">
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
    <section class="arena-match-team"><b>${safe(teams[0].map(p=>p.name||'Học viên').join(' + '))}</b>${teams[0].map(playerCard).join('')}</section>
    <span class="arena-match-vs">VS</span>
    <section class="arena-match-team"><b>${safe(teams[1].map(p=>p.name||'Học viên').join(' + '))}</b>${teams[1].map(playerCard).join('')}</section>
   </div>
   <div class="arena-levels"><button class="arena-level active" type="button">LỚP HỌC · 20 CÂU</button><button class="arena-level locked" disabled type="button">🔒 N4 · SẮP MỞ</button></div><p class="arena-match-note">20 câu từ lớp học IKIGAI · 15 giây/câu · Đồng bộ thời gian và bảng điểm trực tuyến</p>
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
function requestArenaStart(){if(!joined){toast('Cần kết nối máy chủ để giao đấu đồng bộ');return}const roster=arenaRoster();const needed=arenaMode==='1v1'?2:4;if(roster.length!==needed){toast('Chưa đủ người chơi sẵn sàng');return}const host=roster[0].user_id;if(user.id!==host){toast('Đang chờ chủ trận bắt đầu…');arenaSend('start-request',{host});return}startArenaHost(roster)}
function handleArenaMatchEvent(e){if(!e||currentPlace!=='arena'||!user||rankedSession)return;
 if(e.kind==='start-request'){if(arenaReady&&arenaRoster()[0]?.user_id===user.id&&!arenaMatch)startArenaHost(arenaRoster());return}
 if(e.kind==='start'){if(e.from!==arenaRoster()[0]?.user_id||!e.players?.some(p=>p.id===user.id))return;acceptArenaStart(e);return}
 if(!arenaMatch||e.id!==arenaMatch.id||!arenaMatch.players.some(p=>p.id===e.from))return;
 if(e.kind==='answer'){const key=e.from+':'+e.round;if(arenaMatchAnswers[key]||e.round<0||e.round>=20)return;arenaMatchAnswers[key]=true;const q=arenaMatch.questions[e.round];if(!q)return;const ok=e.answer===q.correct;const pts=ok?100:0;arenaMatchResults[e.from]=(arenaMatchResults[e.from]||0)+pts;renderArenaBattle();return}
 if(e.kind==='score-sync'&&e.from===arenaMatch.players[0].id){arenaMatchResults={...e.scores};renderArenaBattle();return}
}
let arenaClassroomLoading=false;
async function loadClassroomArenaQuestions(){
 let rows;
 try{if(!client)throw Error('No session');const {data,error}=await client.rpc('ikigai_classroom_arena_bank');if(error)throw error;rows=data;}
 catch(error){console.warn('Live classroom arena bank:',error);const response=await fetch('assets/ikigai-classroom-arena-bank.json?v=1');if(!response.ok)throw Error('Chưa tải được ngân hàng lớp học');rows=(await response.json()).questions.map(q=>({...q,question:[q.prefix,q.question].filter(Boolean).join('\n\n')}));}
 return (Array.isArray(rows)?rows:[]).filter(q=>q&&typeof q.id==='string'&&['vocabulary','grammar','kanji'].includes(q.group)&&typeof q.question==='string'&&Array.isArray(q.options)&&q.options.length===4&&q.options.every(o=>typeof o==='string'&&o.trim())&&new Set(q.options).size===4&&/^[ABCD]$/.test(q.correct));
}
async function arenaSeedQuestions(){
 const rows=await loadClassroomArenaQuestions(),chosen=[];
 for(const [group,count] of [['vocabulary',7],['grammar',7],['kanji',6]]){const pool=rows.filter(q=>q.group===group);if(pool.length<count)throw Error('Ngân hàng lớp học chưa đủ câu '+group);chosen.push(...shuffle(pool).slice(0,count));}
 return shuffle(chosen).map(q=>{const order=shuffle([0,1,2,3]);return {...q,options:order.map(i=>q.options[i]),correct:'ABCD'[order.indexOf('ABCD'.indexOf(q.correct))]};});
}
async function startArenaHost(roster){
 if(arenaMatch||arenaClassroomLoading)return;arenaClassroomLoading=true;
 try{
  const mode=arenaMode,questions=await arenaSeedQuestions();
  const current=arenaRoster();if(currentPlace!=='arena'||arenaMatch||mode!==arenaMode||current.map(p=>p.user_id).join()!==roster.map(p=>p.user_id).join())return;
  const payload={id:crypto.randomUUID(),source:'classroom-v1',mode,players:roster.map(p=>({id:p.user_id,name:p.name||'Học viên'})),ids:questions.map(q=>q.id),questions,startedAt:Date.now()+3500,seconds:ARENA_SECONDS};
  await arenaSend('start',payload);acceptArenaStart(payload);
 }catch(error){console.error('Arena classroom bank:',error);toast(error.message||'Chưa tải được ngân hàng lớp học');}
 finally{arenaClassroomLoading=false;}
}
function acceptArenaStart(m){
 if(arenaMatch)return;
 const roster=arenaRoster(),needed=arenaMode==='1v1'?2:4;
 if(m.source!=='classroom-v1'){toast('Hãy tải lại game để dùng ngân hàng lớp học mới.');return;}
 if(m.mode!==arenaMode||!Array.isArray(m.players)||m.players.length!==needed||new Set(m.players.map(p=>p.id)).size!==needed||m.players.some((p,i)=>p.id!==roster[i]?.user_id)||!m.players.some(p=>p.id===user.id))return;
 if(!Array.isArray(m.questions)||m.questions.length!==20||new Set(m.questions.map(q=>q?.id)).size!==20||!Number.isFinite(m.startedAt)||Math.abs(m.startedAt-Date.now())>15000)return;
 const questions=m.questions.map(q=>({id:String(q.id),group:q.group,question:q.question,options:q.options,correct:q.correct,image:q.image,image_alt:q.image_alt}));
 if(questions.some(q=>!q.id.startsWith('CLASS-')||!['vocabulary','grammar','kanji'].includes(q.group)||typeof q.question!=='string'||q.question.length>16000||!Array.isArray(q.options)||q.options.length!==4||q.options.some(o=>typeof o!=='string'||!o.trim()||o.length>4000)||new Set(q.options).size!==4||!/^[ABCD]$/.test(q.correct)))return;
 arenaMatch={...m,seconds:ARENA_SECONDS,questions};arenaMatchResults=Object.fromEntries(m.players.map(p=>[p.id,0]));arenaMatchAnswers={};arenaMatchFinalized=false;$('arenaBattle')?.remove();renderArenaBattle();clearInterval(arenaMatchTick);arenaMatchTick=setInterval(arenaBattleClock,150);arenaBattleClock();
}
function arenaQuestionImage(question){const src=question?.image;return typeof src==='string'&&/^grammar-assets\/[\w/.-]+\.(png|jpe?g|webp)$/i.test(src)?`<img class="arena-question-image" src="${safe(src)}" alt="${safe(question.image_alt||'Hình câu hỏi')}">`:'';}
function arenaOutcomeNames(left,right,leftScore,rightScore,outcome){
 const names=players=>players.map(p=>safe(p.name||'Học viên')).join(' + ');
 const draw=outcome?outcome==='draw':leftScore===rightScore,leftWins=outcome?outcome==='win':leftScore>rightScore,winners=draw?left:leftWins?left:right,losers=draw?right:leftWins?right:left;
 const winScore=leftWins?leftScore:rightScore,loseScore=leftWins?rightScore:leftScore;
 return `<div class="arena-named-result"><section><small>${draw?'🤝 HÒA':'🏆 CHIẾN THẮNG'}</small><strong>${names(winners)}</strong><b>${draw?leftScore:winScore}</b></section><span>VS</span><section><small>${draw?'🤝 HÒA':'⚔️ THẤT BẠI'}</small><strong>${names(losers)}</strong><b>${draw?rightScore:loseScore}</b></section></div>`;
}

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
 const el=$('arenaBattleContent');if(!el)return;el.innerHTML=`<div class="arena-battle-head"><span>⚔️ IKIGAI · CLASSROOM BATTLE</span><button class="arena-exit" id="arenaExit">✕ Rời trận</button></div><div class="arena-battle-score"><div>🔵 ${left}<strong>${team0}</strong></div><div class="arena-battle-round">CÂU ${i+1}/20 <b id="arenaClock">${round<0?'CHUẨN BỊ':remaining+'s'}</b></div><div>🟣 ${right}<strong>${team1}</strong></div></div><div class="arena-duel-bar"><i style="width:${team0+team1?100*team0/total:50}%"></i></div><div class="arena-battle-track"><i style="width:${Math.max(0,round)/20*100}%"></i></div><div class="arena-question-type">${({vocabulary:'TỪ VỰNG',grammar:'NGỮ PHÁP',kanji:'KANJI'})[q.group]||'N5'}</div><div class="arena-battle-question">${safe(q.question)}</div>${arenaQuestionImage(q)}<div class="arena-battle-answers">${options}</div><div class="arena-battle-feedback" id="arenaBattleFeedback">${round<0?'Trận đấu sắp bắt đầu…':answered?'Đã ghi nhận câu trả lời · Đợi câu tiếp theo':'Chọn đáp án trước khi hết giờ!'}</div>`;
 el.querySelector('#arenaExit').onclick=()=>{stopArenaMatch();leaveArenaQueue()};el.querySelectorAll('[data-arena-answer]').forEach(b=>b.onclick=()=>answerArena(b.dataset.arenaAnswer));}
function answerArena(answer){const m=arenaMatch,round=arenaRound();if(!m||round<0||round>=20||arenaMatchAnswers[user.id+':'+round])return;const q=m.questions[round],ok=answer===q.correct;arenaMatchAnswers[user.id+':'+round]=true;arenaMatchResults[user.id]=(arenaMatchResults[user.id]||0)+(ok?100:0);arenaSend('answer',{id:m.id,round,answer});arenaSound(ok?'correct':'wrong');renderArenaBattle();const f=$('arenaBattleFeedback');if(f){f.textContent=ok?'✨ 正解 · CHÍNH XÁC! +100':'💥 不正解 · CHƯA CHÍNH XÁC!';f.classList.toggle('arena-feedback-correct',ok);f.classList.toggle('arena-feedback-wrong',!ok)}}
let arenaLastRound=-999;
function arenaBattleClock(){if(!arenaMatch)return;const r=arenaRound();if(r!==arenaLastRound){arenaLastRound=r;renderArenaBattle()}else{const el=$('arenaClock');if(el){const rem=Math.max(0,Math.ceil((arenaMatch.startedAt+(r+1)*arenaMatch.seconds*1000-Date.now())/1000));el.textContent=r<0?'CHUẨN BỊ':rem+'s'}}if(r>=20){clearInterval(arenaMatchTick);renderArenaResult()} }
function renderArenaResult(){const m=arenaMatch;if(!m||arenaMatchFinalized)return;arenaMatchFinalized=true;
 const a=arenaTeamScore(0),b=arenaTeamScore(1),mine=m.players.findIndex(p=>p.id===user.id)<(m.mode==='1v1'?1:2),mineScore=mine?a:b,otherScore=mine?b:a;
 const result=a===b?'draw':mineScore>otherScore?'win':'lose';arenaSound(result);
 const labels={win:['勝ち','CHIẾN THẮNG','🏆'],lose:['負け','THẤT BẠI','⚔️'],draw:['引き分け','HÒA','🤝']};const [jp,vi,emoji]=labels[result];
 const el=$('arenaBattleContent');if(!el)return;
 el.innerHTML=`<div class="arena-result arena-result-gunny ${result==='win'?'victory':result==='lose'?'defeat':'draw'}"><div class="arena-result-rays" aria-hidden="true"></div><div class="arena-result-icon">${emoji}</div><div class="arena-result-jp" lang="ja">${jp}</div><h2>${vi}</h2>${arenaOutcomeNames(m.players.slice(0,m.mode==='1v1'?1:2),m.players.slice(m.mode==='1v1'?1:2),a,b)}<small>HOÀN THÀNH 20 CÂU HỎI LỚP HỌC</small><button class="gold" id="arenaResultExit">TRỞ VỀ SẢNH</button></div>`;
 el.querySelector('#arenaResultExit').onclick=()=>{stopArenaMatch();leaveArenaQueue()};
}
function stopArenaMatch(){clearInterval(arenaMatchTick);arenaMatchTick=null;arenaMatch=null;arenaMatchAnswers={};arenaMatchResults={};arenaMatchFinalized=false;arenaLastRound=-999;$('arenaBattle')?.remove()}

function renderRoomPeers(){if(currentPlace==='arena')renderArenaLobbyPeers();if(currentPlace==='class')return;const host=$('roomScene').querySelector('.room-actors');if(!host)return;host.querySelectorAll('.room-actor[data-peer="true"]').forEach(el=>el.remove());Object.values(people).filter(p=>p.scene==='room'&&p.place===currentPlace&&p.user_id!==user.id).forEach(p=>host.insertAdjacentHTML('beforeend',roomCharacter({x:p.roomX??50,y:p.roomY??70},p.user_id||p.id,p.name,p.role,p.gender,p.avatar)))}
function backMap(){window.IKIGAI_DIARY?.study(null);if(rankedSession){toast('Hãy rời màn hình xếp hạng trước khi về bản đồ.');return}closeSettings();closeMembers();roomQuizRequest++;stopArenaMatch();$('chatbox').classList.remove('open','arena-inline-chat');$('roomScene').querySelector('.arena-chat-card')?.classList.remove('chat-expanded');if($('chatbox').parentElement!==document.body)document.body.appendChild($('chatbox'));restoreMusicToggle();window.IKIGAI_AUDIO?.play('map');if(arenaMode)leaveArenaQueue();$('roomScene').hidden=true;$('mapScene').hidden=false;if(channel&&joined){channel.track(profile());channel.send({type:'broadcast',event:'scene',payload:{user_id:user.id,name:nickname,scene:'map',place:'map'}})}renderActors()}
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

function setClassBoard(mode,count,question,optionsHTML=''){window.IKIGAI_DIARY?.study(null);
 const title=$('classBoardMode'),counter=$('classBoardCount'),prompt=$('classBoardQuestion'),opts=$('classBoardOptions');
 if(title)title.textContent=mode;
 if(counter)counter.textContent=count;
 if(prompt)prompt.textContent=question;
 if(opts)opts.innerHTML=optionsHTML;
 const feedback=$('boardFeedback');if(feedback){feedback.textContent='';feedback.className='board-feedback';}
 const footer=$('classBoardFooter');if(footer)footer.innerHTML='';
 const activity=$('activity');if(activity)activity.hidden=true;
}
window.IKIGAI_KOTOBA_AWARD=async payload=>{if(!client||!user||role==='guest'||role==='teacher'||!profileLoaded)return {guest:true};const {data,error}=await client.rpc('ikigai_kotoba_answer',payload);if(error)throw error;xp=Number(data.xp??xp);save();if(channel&&joined)channel.track(profile()).catch(()=>{});return data};
function openKotobaNinja(){
 if(currentPlace!=='class'||document.getElementById('kotobaNinjaOverlay'))return;
 roomQuizRequest++;
 if(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)){const url='kotoba-ninja.html?v=1.8.0-minna50-approval&class=1';const tab=window.open(url,'_blank');if(!tab)location.href=url;return;}
 const host=$('game'),previous=document.activeElement;
 const overlay=document.createElement('section');overlay.id='kotobaNinjaOverlay';
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','KOTOBA NINJA');
 Object.assign(overlay.style,{position:'absolute',inset:'0',zIndex:'2147483000',display:'flex',flexDirection:'column',background:'#101c25',color:'#fff'});
 const header=document.createElement('div');Object.assign(header.style,{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'2px 8px',fontSize:'11px',lineHeight:'1.1',background:'#17313b',flexShrink:'0'});
 const label=document.createElement('strong');label.textContent='IKIGAI EDUCATION · KOTOBA NINJA';
 const close=document.createElement('button');close.type='button';close.textContent='← Về phòng học';close.style.cssText='padding:3px 8px;font-size:11px;line-height:1.1;cursor:pointer';
 const frame=document.createElement('iframe');frame.title='KOTOBA NINJA';frame.setAttribute('allow','autoplay');frame.src='kotoba-ninja.html?v=1.8.0-minna50-approval';frame.style.cssText='width:100%;flex:1;min-height:0;border:0;display:block';
 const nodes=Array.from(host.children);if(!host.contains($('chatbox'))&&$('chatbox'))nodes.push($('chatbox'));
 const old=nodes.map(el=>[el,el.inert]);old.forEach(([el])=>el.inert=true);
 const oldPosition=host.style.position;if(getComputedStyle(host).position==='static')host.style.position='relative';
 const leave=()=>{try{frame.contentWindow?.speechSynthesis?.cancel()}catch{}overlay.remove();old.forEach(([el,v])=>el.inert=v);host.style.position=oldPosition;window.IKIGAI_AUDIO?.resume?.();previous?.focus?.();};
 close.onclick=leave;overlay.addEventListener('keydown',e=>{if(e.key==='Escape')leave()});
 header.append(label,close);overlay.append(header,frame);host.append(overlay);window.IKIGAI_AUDIO?.suspend?.();close.focus();
}
window.IKIGAI_BUNPOU_AWARD=async payload=>{
 if(!client||!user||role==='guest'||role==='teacher'||!profileLoaded)return {guest:true};
 const {data,error}=await client.rpc('ikigai_bunpou_answer',payload);if(error)throw error;
 xp=Number(data?.xp??xp);save();if(channel&&joined)channel.track(profile()).catch(()=>{});if(currentPlace==='class')renderClassLeaderboard();return data;
};
window.openBunpouTetris=openBunpouTetris;
function openBunpouTetris(){
 if(currentPlace!=='class'||document.getElementById('bunpouTetrisOverlay'))return;
 roomQuizRequest++;
 if(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)){const url='bunpou-tetris.html?v=20261121-20q-approval&class=1';const tab=window.open(url,'_blank');if(!tab)location.href=url;return;}
 const host=$('game'),previous=document.activeElement;
 const overlay=document.createElement('section');overlay.id='bunpouTetrisOverlay';
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','BUNPOU TETRIS');
 Object.assign(overlay.style,{position:'absolute',inset:'0',zIndex:'2147483000',display:'flex',flexDirection:'column',background:'#101c25',color:'#fff'});
 const header=document.createElement('div');Object.assign(header.style,{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'2px 8px',fontSize:'11px',lineHeight:'1.1',background:'#17313b',flexShrink:'0'});
 const label=document.createElement('strong');label.textContent='IKIGAI EDUCATION · BUNPOU TETRIS';
 const close=document.createElement('button');close.type='button';close.textContent='← Về phòng học';close.style.cssText='padding:3px 8px;font-size:11px;line-height:1.1;cursor:pointer';
 const frame=document.createElement('iframe');frame.title='BUNPOU TETRIS';frame.setAttribute('allow','autoplay');frame.src='bunpou-tetris.html?v=20261121-20q-approval';frame.style.cssText='width:100%;flex:1;min-height:0;border:0;display:block';
 const nodes=Array.from(host.children);if(!host.contains($('chatbox'))&&$('chatbox'))nodes.push($('chatbox'));
 const old=nodes.map(el=>[el,el.inert]);old.forEach(([el])=>el.inert=true);
 const oldPosition=host.style.position;if(getComputedStyle(host).position==='static')host.style.position='relative';
 const onMessage=e=>{if(e.origin===location.origin&&e.source===frame.contentWindow&&e.data==='bunpou-close')leave()};const leave=()=>{window.removeEventListener('message',onMessage);try{frame.contentWindow?.speechSynthesis?.cancel()}catch{}overlay.remove();old.forEach(([el,v])=>el.inert=v);host.style.position=oldPosition;window.IKIGAI_AUDIO?.resume?.();previous?.focus?.();};
 window.addEventListener('message',onMessage);close.onclick=leave;overlay.addEventListener('keydown',e=>{if(e.key==='Escape')leave()});
 header.append(label,close);overlay.append(header,frame);host.append(overlay);window.IKIGAI_AUDIO?.suspend?.();close.focus();
}
// The overlay is inside #game so it inherits the existing landscape canvas.
window.openVerbPractice=openVerbPractice;
function openVerbPractice(){
 if(currentPlace!=='class'||$('verbPracticeOverlay'))return;
 roomQuizRequest++;
 const host=$('game'),previous=document.activeElement,overlay=document.createElement('section');
 overlay.id='verbPracticeOverlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Luyện chia thể động từ');
 overlay.style.cssText='position:absolute;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:#09162c;color:#edf5ff';
 const header=document.createElement('header');header.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:3px 9px;background:#17313b;font-size:10px;flex-shrink:0';
 const title=document.createElement('strong');title.textContent='IKIGAI · NGỮ PHÁP';
 const close=document.createElement('button');close.type='button';close.textContent='← Phòng học';close.style.cssText='padding:4px 10px;font-size:11px;border:1px solid #d7b76d;border-radius:6px;background:#19314c;color:#fff4d8;cursor:pointer';
 const frame=document.createElement('iframe');frame.title='Luyện chia thể N5 và N4';frame.src='verb-practice/index.html?v=20261117-coins-1';frame.allow='autoplay';frame.style.cssText='width:100%;flex:1;min-height:0;border:0;display:block';
 const old=Array.from(host.children).map(el=>[el,el.inert]);old.forEach(([el])=>el.inert=true);
 const oldPosition=host.style.position;if(getComputedStyle(host).position==='static')host.style.position='relative';
 const leave=()=>{frame.src='about:blank';overlay.remove();old.forEach(([el,value])=>el.inert=value);host.style.position=oldPosition;window.IKIGAI_AUDIO?.resume?.();previous?.focus?.();};
 close.onclick=leave;overlay.addEventListener('keydown',e=>{if(e.key==='Escape')leave()});header.append(title,close);overlay.append(header,frame);host.append(overlay);window.IKIGAI_AUDIO?.suspend?.();close.focus();
}
// Classroom Kanji is now an independent, ordered bomb-defusal course.
function openKanjiBomb(){
 if(currentPlace!=='class'||$('kanjiBombOverlay'))return;
 roomQuizRequest++;
 const host=$('game'),previous=document.activeElement,overlay=document.createElement('section');
 overlay.id='kanjiBombOverlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Gỡ bom Kanji');
 Object.assign(overlay.style,{position:'absolute',inset:'0',zIndex:'2147483000',display:'flex',flexDirection:'column',background:'#101923',color:'#fff'});
 const bar=document.createElement('div');bar.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:2px 8px;background:#17313b;font-size:11px;flex-shrink:0';
 const label=document.createElement('strong');label.textContent='IKIGAI EDUCATION · GỠ BOM KANJI';
 const close=document.createElement('button');close.type='button';close.textContent='← Về phòng học';close.style.cssText='padding:4px 9px;font-size:11px;cursor:pointer';
 const frame=document.createElement('iframe');frame.title='Gỡ bom Kanji · 32 bài';frame.allow='autoplay';frame.src='kanji-bomb.html?v=20261121-verified-approval&player='+encodeURIComponent(user?.id||'guest');frame.style.cssText='width:100%;flex:1;min-height:0;border:0;display:block';
 const nodes=Array.from(host.children);if($('chatbox')&&!host.contains($('chatbox')))nodes.push($('chatbox'));
 const old=nodes.map(node=>[node,node.inert]);old.forEach(([node])=>node.inert=true);
 const position=host.style.position;if(getComputedStyle(host).position==='static')host.style.position='relative';
 let closed=false;const attempts=new Set();
 function leave(){if(closed)return;closed=true;window.removeEventListener('message',onMessage);overlay.remove();old.forEach(([node,inert])=>node.inert=inert);host.style.position=position;window.IKIGAI_AUDIO?.resume?.();previous?.focus?.();}
 async function onMessage(event){
  if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
  if(event.data==='kanji-bomb-close'){leave();return;}
  const payload=event.data;if(payload?.type!=='kanji-bomb-result')return;
  const lesson=payload.lesson,total=lesson===32?13:10,first=(lesson-1)*10+1;
  if(!Number.isInteger(lesson)||lesson<1||lesson>32||!Array.isArray(payload.results)||payload.results.length!==total||!/^[-a-f0-9]{36}$/i.test(payload.attemptId||''))return;
  if(payload.results.some((row,i)=>row?.id!=='KB-N5-'+String(first+i).padStart(3,'0')||!['string','object'].includes(typeof row.reading)||!['string','object'].includes(typeof row.meaning)))return;
  if(attempts.has(payload.attemptId))return;attempts.add(payload.attemptId);
  const reply=message=>{if(!closed)frame.contentWindow?.postMessage({type:'kanji-bomb-award',attemptId:payload.attemptId,message},location.origin)};
  if(role==='guest'||role==='teacher'||!client||!user||!profileLoaded){reply('Đã lưu tiến độ trên thiết bị. '+(role==='teacher'?'Giáo viên không nhận EXP.':'Chế độ khách không nhận EXP.'));return;}
  
  try{
   const {data,error}=await client.rpc('ikigai_kanji_bomb_verified',{p_lesson:lesson,p_attempt:payload.attemptId,p_answers:payload.results});
   if(error)throw error;xp=Number(data?.xp??xp);coins=Number(data?.coins??coins);save();
   if(channel&&joined)channel.track(profile()).catch(()=>{});if(currentPlace==='class')renderClassLeaderboard();
   window.IKIGAI_TASKS?.refresh(true);reply('Đã đồng bộ: +'+Number(data?.xp_awarded||0)+' EXP · '+Number(data?.coins_awarded||0)+' xu. '+(Number(data?.correct)===total?'Đạt 100%.':'Chưa đạt 100%.'));
  }catch(error){console.warn('Kanji bomb result sync:',error);reply('Đã lưu tiến độ trên thiết bị; chưa đồng bộ được EXP.');}
 }
 window.addEventListener('message',onMessage);close.onclick=leave;
 overlay.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape')leave()});
 bar.append(label,close);overlay.append(bar,frame);host.append(overlay);window.IKIGAI_AUDIO?.suspend?.();close.focus();
}

function openLessonPicker(group,skipGrammarMenu=false){window.IKIGAI_DIARY?.study(null);
 if(group==='kanji'&&currentPlace==='class'){openKanjiBomb();return;}
 if(group==='grammar'&&currentPlace==='class'&&!skipGrammarMenu){roomQuizRequest++;setClassBoard('文法 · NGỮ PHÁP','CHỌN HÌNH THỨC','Luyện xếp câu hoặc kiểm tra kiến thức.', '<button class="board-choice" id="bunpouPlay">🧩 BUNPOU TETRIS · 500 câu</button><button class="board-choice" id="verbPracticePlay">🌸 LUYỆN CHIA THỂ · N5 / N4</button><button class="board-choice" id="grammarTest">📝 KIỂM TRA NGỮ PHÁP</button>');$('bunpouPlay').onclick=openBunpouTetris;$('verbPracticePlay').onclick=openVerbPractice;$('grammarTest').onclick=()=>openLessonPicker(group,true);return;}

 if(group==='vocabulary'&&currentPlace==='class'){openKotobaNinja();return;}
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
 if(group==='kanji'&&currentPlace==='class'){openKanjiBomb();return;}
 if(group==='vocabulary'&&currentPlace==='class'){openKotobaNinja();return;}
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
 quizRewardRoom='class';quizRewardGroup=group;quizRewardLesson=lesson;qpos=0;score=0;renderClassGame(lesson);
}
function renderClassGame(lesson){
 const q=qset[qpos],correct='ABCD'.indexOf(q.correct),kind=studyGroupLabels[activeGroup];
 const fruits=['🍉','🍊','🍓','🍍'];
 setClassBoard(kind+' · BÀI '+lesson,'CÂU '+(qpos+1)+' / '+qset.length+' · BÀI CÁ NHÂN',q.question,
 q.options.map((o,i)=>`<button class="board-choice board-answer" data-opt="${i}"><span class="board-answer-icon">${activeGroup==='vocabulary'?fruits[i]:'ABCD'[i]}</span><b>${'ABCD'[i]}.</b> ${safe(o)}</button>`).join(''));
 window.IKIGAI_DIARY?.study(kind+' · Minna Bài '+lesson,$('roomScene'));
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
async function finishClassBoard(){window.IKIGAI_DIARY?.study(null);
 window.IKIGAI_AUDIO?.success();
 const earned=score*10,synced=await persistAward();
 const result=role==='guest'?'Bạn đang chơi chế độ khách; điểm không được lưu.':role==='teacher'?'Tài khoản giáo viên không nhận XP học viên.':synced?`Đã cộng ${lastQuizXp} XP · ${lastQuizCoins} xu vào tài khoản.`:'Chưa cộng thưởng do chưa đồng bộ được dữ liệu.';
 setClassBoard('HOÀN THÀNH THỬ THÁCH','KẾT QUẢ CÁ NHÂN',`🏆 ${score}/${qset.length} câu đúng`,
 `<p class="board-result-note">${safe(result)}</p><button class="board-choice" id="againBoard">LUYỆN LẠI</button><button class="board-choice" id="doneBoard">CHỌN NỘI DUNG KHÁC</button>`);
 $('againBoard')?.addEventListener('click',()=>openLessonPicker(activeGroup));
 $('doneBoard')?.addEventListener('click',()=>setClassBoard('BẢNG HỌC TẬP IKIGAI','TỰ HỌC CÁ NHÂN','Chọn một chức năng bên phải để bắt đầu.',''));
}
function openJftPractice(trigger){
 const panel=$('jftPractice'),host=$('jftPracticeHost'),close=$('closeJftPractice'),game=$('game');
 if(!panel.hidden)return;
 const controller=new AbortController();
 roomQuizRequest++;
 const backgroundNodes=Array.from(game.children).filter(el=>el!==panel);
 if(!game.contains($('chatbox')))backgroundNodes.push($('chatbox'));
 const background=backgroundNodes.map(el=>[el,el.inert]);
 const leave=()=>{
  if(panel.hidden)return;
  panel.hidden=true;
  panel.onkeydown=null;
  controller.abort();
  background.forEach(([el,inert])=>{el.inert=inert});
  game.classList.remove('jft-active');
  window.IKIGAI_AUDIO?.resume?.();
  trigger?.focus({preventScroll:true});
 };
 const escape=e=>{
  if(e.key!=='Escape'||e.defaultPrevented||host.shadowRoot?.querySelector('dialog[open]'))return;
  e.preventDefault();
  leave();
 };
 close.onclick=leave;
 panel.onkeydown=escape;
 panel.hidden=false;
 game.classList.add('jft-active');
 background.forEach(([el])=>{el.inert=true});
 window.IKIGAI_AUDIO?.suspend?.();
 close.focus({preventScroll:true});
 window.addEventListener('pagehide',()=>controller.abort(),{once:true,signal:controller.signal});
 const loading=host.shadowRoot??host;
 loading.textContent='Đang mở phòng luyện thi…';
 import('./jft-a2/app.js?v=20261127-jft-bulk').then(({mountJftPractice})=>{
  if(!controller.signal.aborted)return mountJftPractice(host,{
   classLink:window.IKIGAI_JFT_CLASS_LINK,jftAccount:window.IKIGAI_JFT_ACCOUNT,signal:controller.signal,onSkillPractice:category=>{close.click();openJftDrills(category)}
  });
 }).catch(()=>{
  if(!controller.signal.aborted)(host.shadowRoot??host).textContent='Chưa mở được phòng luyện thi. Hãy quay lại và thử lại.';
 });
}

const jftStudentId=()=>client&&role==='student'&&!user?.is_anonymous&&user?.app_metadata?.role!=='teacher'?user?.id:null;

async function jftStudentClient(accountId){
 const connected=client;
 if(!accountId||accountId!==jftStudentId())throw new Error('Cần đăng nhập lại tài khoản học viên.');
 const {data,error}=await connected.auth.getSession();
 if(error||data.session?.user.id!==accountId)throw new Error('Cần đăng nhập lại tài khoản học viên.');
 return connected;
}

window.IKIGAI_JFT_ACCOUNT=Object.freeze({
 get id(){return jftStudentId()},
 get canSignIn(){return role==='guest'},
 get canManage(){return !!client&&role==='teacher'&&user?.app_metadata?.role==='teacher'},
 async listExams(signal){
  if(!this.canLoad)return [];
  const {data,error}=await client.rpc('ikigai_jft_catalog').abortSignal(signal);if(error)throw error;return data;
 },
 async updateExamDetails(examId,title,description,revision,signal){
  if(!this.canManage)throw new Error('Chỉ giáo viên được sửa tiêu đề và mô tả đề.');
  const {data,error}=await client.rpc('ikigai_jft_details_put',{p_exam_id:examId,p_title:title,p_description:description,p_expected_revision:revision}).abortSignal(signal);
  if(error)throw new Error(error.message||'Chưa lưu được tiêu đề và mô tả.');
  if(data?.id!==examId||data.title!==title||data.source!==description||!Number.isSafeInteger(data.metadataRevision)||data.metadataRevision<=revision)throw new Error('Chưa xác nhận được thay đổi. Hãy mở lại danh sách đề.');
  return data;
 },
 async setExamAccess(examId,isOpen,revision,signal){
  if(!this.canManage)throw new Error('Chỉ giáo viên được mở hoặc đóng đề.');
  const {data,error}=await client.rpc('ikigai_jft_access_put',{p_exam_id:examId,p_is_open:isOpen,p_expected_revision:revision}).abortSignal(signal);
  if(error)throw new Error(error.message||'Chưa đổi được trạng thái đề.');
  if(data?.controlled!==true||data.open!==isOpen||!Number.isSafeInteger(data.revision)||data.revision<=revision)throw new Error('Chưa xác nhận được trạng thái đề. Hãy cập nhật danh sách.');
  return data;
 },
 async loadText(examId,signal){
  if(!this.canLoad)throw new Error('Cần đăng nhập để tải nội dung đề.');
  const {data,error}=await client.rpc('ikigai_jft_text_get',{p_exam_id:examId}).abortSignal(signal);
  if(error)throw new Error('Chưa tải được bản chữ của đề: '+error.message);
  return data;
 },
 async loadFurigana(examId,signal){
  if(!this.canLoad)throw new Error('Cần đăng nhập để tải furigana.');
  const {data,error}=await client.rpc('ikigai_jft_furigana_get',{p_exam_id:examId}).abortSignal(signal);
  if(error)throw new Error('Chưa tải được furigana: '+error.message);
  return data;
 },
 async saveFurigana(examId,number,fields,revision,signal){
  if(!this.canManage)throw new Error('Chỉ giáo viên được sửa furigana.');
  const {data,error}=await client.rpc('ikigai_jft_furigana_put',{p_exam_id:examId,p_question_number:number,p_fields:fields,p_expected_revision:revision}).abortSignal(signal);
  if(error)throw new Error(error.message||'Chưa lưu được furigana.');
  if(data?.number!==number||!Number.isSafeInteger(data.revision)||data.revision<=revision)throw new Error('Chưa xác nhận được furigana vừa lưu. Hãy mở lại đề.');
  return data;
 },
 async loadQuestionEdits(examId,revision,signal){
  if(!this.canLoad)throw new Error('Cần đăng nhập để tải câu hỏi.');
  const {data,error}=await client.rpc('ikigai_jft_question_edits_get',{p_exam_id:examId,p_revision:revision}).abortSignal(signal);
  if(error)throw error;
  return data;
 },
 async updateExamQuestions(examId,revision,changes,signal){
  if(!this.canManage)throw Error('Chỉ giáo viên được cập nhật đề.');
  const {data,error}=await client.rpc('ikigai_jft_question_edits_apply',{
   p_exam_id:examId,p_expected_revision:revision,p_changes:changes
  }).abortSignal(signal);
  if(error)throw Error(error.message||'Chưa cập nhật được đề.');
  if(data?.id!==examId || data.count!==changes.length || data.revision!==revision+changes.length)throw Error('Chưa xác nhận được lần cập nhật. Hãy xem trước lại.');
  return data;
 },
 async saveQuestionEdit(examId,number,fields,revision,signal){
  if(!this.canManage)throw new Error('Chỉ giáo viên được sửa câu hỏi.');
  const {data,error}=await client.rpc('ikigai_jft_question_edits_put',{
   p_exam_id:examId,p_question_number:number,p_fields:fields,p_expected_revision:revision
  }).abortSignal(signal);
  if(error)throw error;
  if(data?.number!==number||!Number.isSafeInteger(data.revision)||data.revision<=revision)throw new Error('Chưa xác nhận được thay đổi. Hãy mở lại đề.');
  return data;
 },
 async loadAudio(examId,signal){
  if(!this.canLoad)throw new Error('Cần đăng nhập để tải âm thanh.');
  const {data,error}=await client.rpc('ikigai_jft_audio_get',{p_exam_id:examId}).abortSignal(signal);
  if(error)throw new Error('Chưa tải được audio cập nhật: '+error.message);
  return data;
 },
 async importAudio(batch,signal,onProgress){
  if(!this.canManage)throw new Error('Chỉ giáo viên được cập nhật âm thanh.');
  const normalize=turns=>JSON.stringify(turns.map(([r,t])=>[r,t.replace(/\s+/g,'')]));
  const completed=[];let count=0;const total=batch.tests.reduce((n,t)=>n+t.questions.length,0);
  // Validate all targets before the first write. Keep original packages and score proofs intact.
  const targets=[];
  for(const test of batch.tests){
   const original=JSON.parse(await this.loadExam(test.id,signal));
   const exam=original.tests?.find(t=>t.id===test.id);
   if(!exam||exam.questions.length!==50)throw new Error(test.id+': không tìm thấy đề gốc 50 câu.');
   const previous=await this.loadAudio(test.id,signal);
   for(const q of test.questions){
    const source=exam.questions[q.number-1];
    if(source?.section!==2||!source.listen||normalize(source.listen.turns)!==normalize(q.turns))throw new Error(test.id+' câu '+q.number+': lời thoại không khớp đề gốc. Chưa thay âm thanh.');
    targets.push({test,q,previous:previous.find(x=>x.number===q.number)?.sha256??null});
   }
  }
  for(const {test,q,previous} of targets){
   if(signal?.aborted)throw new DOMException('Đã dừng cập nhật.','AbortError');
   onProgress?.({completed:count,total,title:test.title+' · Câu '+q.number});
   const {data,error}=await client.rpc('ikigai_jft_audio_put',{p_exam_id:test.id,p_question_number:q.number,p_mp3:q.mp3,p_sha256:q.sha256,p_expected_sha256:previous}).abortSignal(signal);
   if(error)throw new Error('Đã cập nhật '+count+'/'+total+' câu. '+test.title+' câu '+q.number+': '+error.message+'. Có thể nạp lại cùng tệp để tiếp tục.');
   if(data?.sha256!==q.sha256||data?.number!==q.number)throw new Error('Chưa xác nhận được âm thanh vừa lưu. Hãy nạp lại tệp.');
   completed.push(data);count++;onProgress?.({completed:count,total,title:test.title+' · Câu '+q.number});
  }
  return completed;
 },
 async importExams(payload,signal,onProgress){
  if(!this.canManage)throw new Error('Chỉ giáo viên được nạp đề.');
  const batch=JSON.parse(payload),added=[];
  for(let i=0;i<batch.tests.length;i++){
   if(signal?.aborted)throw new DOMException('Đã dừng nạp đề.','AbortError');
   const test=batch.tests[i];
   onProgress?.({completed:i,total:batch.tests.length,title:test.title});
   const single=JSON.stringify({format:batch.format,source:batch.source,tests:[test]});
   const {data,error}=await client.rpc('ikigai_jft_import',{p_package_text:single}).abortSignal(signal);
   if(error){
    const detail=/statement timeout/i.test(error.message||'')?'Máy chủ xử lý quá lâu; hãy thử lại.':error.message;
    const failure=new Error(`Đã lưu ${i}/${batch.tests.length} đề. Chưa lưu ${test.title}: ${detail||'Hãy thử lại.'} Các đề đã lưu sẽ được giữ nguyên khi nạp lại.`);
    failure.imported=added;throw failure;
   }
   if(!Array.isArray(data)||data.length!==1||data[0].id!==test.id)throw new Error(`Chưa xác nhận được ${test.title}. Hãy mở lại danh sách đề để kiểm tra rồi thử lại.`);
   added.push(data[0]);
   onProgress?.({completed:i+1,total:batch.tests.length,title:test.title});
  }
  return added;
 },
 get canLoad(){return accountApproved&&!!client&&!!user&&role!=='guest'&&!user.is_anonymous},
 signIn(){
  if(role!=='guest')return;
  window.IKIGAI_JFT_CLASS_LINK?.clear();
  location.reload();
 },
 async loadExam(examId,signal){
  if(!/^[a-z0-9][a-z0-9-]{0,49}$/.test(examId)||!client||!user||role==='guest')throw new Error('Cần đăng nhập IKIGAI WORLD.');
  if(!/^sore-vol1-(?:0[1-9]|10)$/.test(examId)){
   const {data,error}=await client.rpc('ikigai_jft_package',{p_exam_id:examId}).abortSignal(signal);if(error)throw error;return data;
  }
  const expected=user.id;
  const {data,error}=await client.auth.getSession();
  const session=data?.session;
  if(error||session?.user.id!==expected||!session.access_token)throw new Error('Cần đăng nhập lại IKIGAI WORLD.');
  const response=await fetch(SUPABASE_URL+'/functions/v1/jft-a2-exams/'+examId,{
   signal,headers:{Authorization:'Bearer '+session.access_token,apikey:SUPABASE_ANON_KEY},credentials:'omit'
  });
  if(!response.ok)throw new Error('Chưa tải được đề. Hãy thử lại.');
  return response.text();
 },
 async recent(accountId,signal){
  const connected=await jftStudentClient(accountId);
  const {data,error}=await connected.rpc('ikigai_jft_recent',{p_account_id:accountId}).abortSignal(signal);
  if(error)throw error;
  return data;
 },
 async submit(accountId,examId,attemptId,answers,signal,revision=0){
  const proof=window.IKIGAI_JFT_CLASS_LINK.scoreProof(examId,revision);
  const connected=await jftStudentClient(accountId);
  const {data,error}=await connected.rpc('ikigai_jft_submit',{
   p_account_id:accountId,p_exam_id:examId,p_attempt_id:attemptId,p_answers:answers,p_class_proof:proof
  }).abortSignal(signal);
  if(error)throw error;
  if(data?.attempt_id!==attemptId)throw new Error('Chưa xác nhận được lượt nộp.');
  try{data.coin_reward=await window.IKIGAI_REWARD_CLIENT.claim('jft_exam',attemptId);}catch{data.coin_reward={pending:true};}
  if(accountId===jftStudentId()&&Number.isInteger(data.xp_total)){
   xp=Math.max(xp,data.xp_total);
   save();
   if(channel&&joined)channel.track(profile()).catch(()=>{});
  }
  return data;
 }
});

let closeJftDrills=null;
async function openJftDrills(category){
 if(role==='guest'||!user||user.is_anonymous){info('Cần đăng nhập','Học viên đăng nhập tài khoản để luyện JFT A2.');return}
 closeJftDrills?.();
 const {mountDrills}=await import('./jft-drills/app.js?v=completion-coins-1');
 closeJftDrills=await mountDrills({host:$('activity'),client,category,canEdit:role==='teacher',onSaved:data=>{xp=Math.max(xp,Number(data.xp_total)||0);save();if(joined)channel?.track(profile())}});
}
let closeN4Practice=null;
async function openN4Practice(){
 if(role==='guest'||!user||user.is_anonymous){info('Cần đăng nhập','Học viên đăng nhập tài khoản IKIGAI để thi thử N4.');return}
 closeN4Practice?.();closeN5Practice?.();closeJftDrills?.();window.IKIGAI_AUDIO?.suspend();
 try{const [{mountN4},{createN4Adapter}]=await Promise.all([import('./n4/app.js?v=shared-jlpt-2'),import('./n4/adapter.js?v=shared-jlpt-2')]);closeN4Practice=await mountN4({host:$('activity'),adapter:createN4Adapter(client),nickname,canEdit:role==='teacher',onClose:()=>window.IKIGAI_AUDIO?.resume()})}catch(e){window.IKIGAI_AUDIO?.resume();info('Chưa mở được thi thử N4',safe(e.message))}
}
let closeN5Practice=null;
async function openN5Practice(){
 if(role==='guest'||!user||user.is_anonymous){info('Cần đăng nhập','Học viên đăng nhập tài khoản IKIGAI để thi thử N5.');return}
 closeN5Practice?.();closeN4Practice?.();closeJftDrills?.();window.IKIGAI_AUDIO?.suspend();
 try{const [{mountN5},{createN5Adapter}]=await Promise.all([import('./n5/app.js?v=n5-de04-cleanimgs-20261123-1'),import('./n5/adapter.js?v=n5-de05-cleanimgs-20261123-1')]);closeN5Practice=await mountN5({host:$('activity'),adapter:createN5Adapter(client),nickname,canEdit:role==='teacher',onClose:()=>window.IKIGAI_AUDIO?.resume()})}catch(e){window.IKIGAI_AUDIO?.resume();info('Chưa mở được thi thử N5',safe(e.message))}
}
function openN4KanjiMenu(){
 const host=$('activity');
 window.IKIGAI_DIARY?.study(null);
 host.hidden=false;
 host.innerHTML='<button type="button" class="close-activity" aria-label="Đóng">×</button><h2>Kanji N4</h2><button type="button" class="gold" data-trap>Bẫy Kanji</button> <button type="button" class="secondary" data-classic>Luyện Kanji</button>';
 host.querySelector('.close-activity').onclick=()=>host.hidden=true;
 host.querySelector('[data-classic]').onclick=()=>startQuiz('kanji');
 const trap=host.querySelector('[data-trap]');
 trap.onclick=async()=>{
  trap.disabled=true;
  try{
   const {mountKanjiTrap}=await import('./n4/kanji-trap.mjs?v=images-2');
   if(host.hidden||!trap.isConnected||currentPlace!=='n4')return;
   window.IKIGAI_AUDIO?.suspend();
   mountKanjiTrap(host,()=>{window.IKIGAI_AUDIO?.resume();if(currentPlace==='n4')openN4KanjiMenu()});
  }catch(e){if(trap.isConnected)info('Chưa mở được Bẫy Kanji',safe(e.message))}
 };
}

function openSakuraMenu(){
 const host=$('activity');host.hidden=false;
 host.innerHTML='<button type="button" class="close-activity">×</button><h2>KAIWA</h2><button type="button" class="gold" data-sakura>🌸 Sakura Sensei · Thử nghiệm</button> <button type="button" class="secondary" data-classic>Kaiwa hiện có</button>';
 host.querySelector('.close-activity').onclick=()=>host.hidden=true;
 host.querySelector('[data-classic]').onclick=()=>{host.hidden=true;openLessonPicker('kaiwa')};
 const btn=host.querySelector('[data-sakura]');
 btn.onclick=async()=>{btn.disabled=true;try{const {mountSakura}=await import('./sakura-kaiwa.mjs?v=371');if(host.hidden||!btn.isConnected||currentPlace!=='class')return;mountSakura(host,()=>{if(currentPlace==='class')openSakuraMenu();else host.hidden=true},user?.id)}catch(e){if(btn.isConnected){btn.disabled=false;info('Chưa mở được Sakura Sensei',safe(e.message))}}};
}
function roomAction(a,trigger){
 if(currentPlace==='class'&&a==='kaiwa'){openSakuraMenu();return}

 if(currentPlace==='n4'&&a==='kanji'){openN4KanjiMenu();return}

 if(currentPlace==='class'&&a==='bunpou'){openBunpouTetris();return;}

 if(currentPlace==='n4'&&a==='mock'){openN4Practice();return}
 if(currentPlace==='n5'&&a==='mock'){openN5Practice();return}

 if(currentPlace==='jft'&&['kanji','vocabulary','hyogen'].includes(a)){openJftDrills(a).catch(e=>info('Chưa mở được bài luyện',safe(e.message)));return}

 if(currentPlace==='jft'&&a==='mock'){openJftPractice(trigger);return}
 if(a==='listening'){
  roomQuizRequest++;
  if(currentPlace==='class')setClassBoard('NGHE HIỂU','CHƯA CÓ ÂM THANH','Bài nghe sẽ được bổ sung khi có ngân hàng âm thanh.','');
  else info('Nghe hiểu','Phòng chưa có ngân hàng âm thanh.');
  return;
 }
 if(currentPlace==='class'&&['vocabulary','grammar','kanji','kaiwa'].includes(a)){openLessonPicker(a);return}
 if(['vocabulary','grammar','kanji','reading','mock','duel'].includes(a)){startQuiz(a);return}
 if(a==='rules'){info('Luật đấu tập','20 câu từ lớp học IKIGAI: 7 từ vựng, 7 ngữ pháp, 6 Kanji. Mỗi câu 15 giây; đúng được 100 điểm. Hai bên làm cùng câu hỏi và cùng thứ tự đáp án. Kết quả hiển thị tên người thắng và người thua.');return}
 if(currentPlace==='gym'&&a.startsWith('culture-')){if(a==='culture-schedule'){showCultureSchedule();return}const topics={'culture-values':['Văn hoá IKIGAI','Chủ động chào hỏi, đoàn kết, hỗ trợ bạn học và không làm ảnh hưởng người khác.'],'culture-trash':['Phân loại rác','Nội dung phân loại theo quy định của trung tâm sẽ được bổ sung.'],'culture-horenso':['HORENSO','報告: Báo cáo. 連絡: Liên lạc. 相談: Trao đổi, xin ý kiến.'],'culture-five':['5S','Sàng lọc, sắp xếp, sạch sẽ, săn sóc, sẵn sàng.']};if(topics[a])info(...topics[a]);return}
 if(a==='tea'){info('Anh Tùng','“Uống trà với anh nhé”. Nghỉ ngơi một chút rồi tiếp tục hành trình học tập nhé.');return}
}

function showCultureSchedule(){
 const a=$('activity');
 const morning=[['08:00 – 08:15','Tự học'],['08:15 – 09:15','Học tiết 1'],['09:15 – 09:25','Nghỉ giải lao'],['09:25 – 10:25','Học tiết 2'],['10:25 – 10:35','Nghỉ giải lao'],['10:35 – 11:30','Học tiết 3'],['11:30 – 13:00','Nghỉ ăn trưa']];
 const afternoon=[['13:00 – 13:15','Tự học'],['13:15 – 14:15','Học tiết 4'],['14:15 – 14:25','Nghỉ giải lao'],['14:25 – 15:25','Học tiết 5'],['15:25 – 15:35','Nghỉ giải lao'],['15:35 – 16:20','Học tiết 6'],['16:20 – 17:00','Thể dục'],['19:30 – 21:30','Học tối']];
 const table=(title,rows)=>'<section><h3>'+title+'</h3><table><tbody>'+rows.map(r=>'<tr><th scope="row">'+r[0]+'</th><td>'+r[1]+'</td></tr>').join('')+'</tbody></table></section>';
 const panels=[
 '<div class="cs-grid">'+table('BUỔI SÁNG',morning)+table('BUỔI CHIỀU & TỐI',afternoon)+'</div>',
 '<div class="cs-grid"><section><h3>Tuần 1 và tuần 3</h3><p>Học thứ 7, nghỉ Chủ nhật.</p><h4>Tuần có học thứ 7</h4><p>Thứ 7: Học theo thời khóa biểu ban ngày.</p><p>Tối thứ 7: Được nghỉ học.</p><p>Chủ nhật: Học từ 09:00 – 11:00.</p><p>Tối Chủ nhật (19:30 – 21:30): Học trở lại bình thường.</p></section><section><h3>Tuần 2 và tuần 4</h3><p>Nghỉ thứ 7 và Chủ nhật.</p><p>Học viên ở lại trung tâm xem mục “Ở lại trung tâm”.</p></section></div>',
 '<section><h3>Tuần nghỉ thứ 7 & Chủ nhật — học viên ở lại trung tâm</h3><p>Tối thứ 6: Học bình thường (19:30 – 21:30).</p><p>Thứ 7: Sáng 09:00 – 11:00 | Chiều 14:00 – 16:00.</p><p>Chủ nhật: Sáng 09:00 – 11:00.</p><p>Tối Chủ nhật (19:30 – 21:30): Học trở lại bình thường.</p></section>'];
 a.innerHTML='<div class="culture-schedule"><button class="close-activity" aria-label="Đóng">×</button><header><small>IKIGAI EDUCATION · Áp dụng từ 05/08/2026</small><h2>THỜI GIAN BIỂU</h2></header><nav aria-label="Mục thời gian biểu">'+['Trong tuần','Cuối tuần','Ở lại trung tâm'].map((x,i)=>'<button data-cs-tab="'+i+'" aria-pressed="'+(i===0)+'">'+x+'</button>').join('')+'</nav><div class="cs-body"></div><footer><strong>Lưu ý:</strong> Có mặt trước giờ học từ 5–10 phút, chuẩn bị đầy đủ sách vở và dụng cụ học tập. Trong thời gian nghỉ cuối tuần, chủ động ôn tập và hoàn thành bài tập. Tuân thủ nội quy và thời gian học của trung tâm.</footer></div>';
 a.hidden=false;const body=a.querySelector('.cs-body');const tabs=[...a.querySelectorAll('[data-cs-tab]')];const select=i=>{body.innerHTML=panels[i];body.scrollTop=0;tabs.forEach((t,j)=>t.setAttribute('aria-pressed',String(i===j)))};tabs.forEach((t,i)=>t.onclick=()=>select(i));a.querySelector('.close-activity').onclick=()=>{a.hidden=true};select(0);
}
function info(title,txt){const a=$('activity');a.hidden=false;a.innerHTML=`<button class="close-activity">×</button><small>IKIGAI WORLD</small><h2>${title}</h2><p>${txt}</p><button class="gold" id="infoOk">ĐÃ HIỂU</button>`;a.querySelector('.close-activity').onclick=()=>a.hidden=true;$('infoOk').onclick=()=>a.hidden=true}
function shuffle(a){const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
async function startQuiz(group){
 const room=currentPlace,request=++roomQuizRequest;
 const available=room==='arena'?await loadClassroomArenaQuestions():group==='duel'||!studyRooms.has(room)?bank:await getStudyQuestions(room);
 if(request!==roomQuizRequest||$('roomScene').hidden)return;
 const isMock=group==='mock'||group==='duel';
 const dedicated=available.filter(q=>q.group===group);
 const rows=isMock&&!dedicated.length?available.filter(q=>['vocabulary','grammar','kanji'].includes(q.group)):dedicated;
 if(!rows.length){info('Chưa có dữ liệu','Chưa có câu hỏi cho mục này trong phòng.');return}
 activeGroup=group;quizRewardRoom=room;quizRewardGroup=group;quizRewardLesson=null;qset=shuffle(rows).slice(0,isMock?20:10);qpos=0;score=0;renderQuestion();
}
function renderQuestion(){window.IKIGAI_DIARY?.study((studyGroupLabels[activeGroup]||activeGroup)+' · '+(placeData[currentPlace]?.[0]||'Luyện tập'),$('activity'));const q=qset[qpos],correct='ABCD'.indexOf(q.correct),a=$('activity');a.hidden=false;a.innerHTML=`<button class="close-activity">×</button><small>NGÂN HÀNG IKIGAI N5 · ${safe(q.id)} · CÂU ${qpos+1}/${qset.length}</small><h2>${activeGroup==='duel'?'ĐẤU TẬP KIẾN THỨC':activeGroup==='mock'?'THI THỬ TỔNG HỢP N5':'LUYỆN TẬP IKIGAI'}</h2><div class="progress"><i style="width:${qpos/qset.length*100}%"></i></div><div class="question">${safe(q.question)}</div><div class="answers">${q.options.map((o,i)=>`<button data-opt="${i}">${'ABCD'[i]}. ${safe(o)}</button>`).join('')}</div><div class="feedback" id="feedback"></div><small class="muted">Điểm: ${score} · Mã câu: ${safe(q.id)}</small>`;a.querySelector('.close-activity').onclick=()=>a.hidden=true;a.querySelectorAll('[data-opt]').forEach(b=>b.onclick=()=>{a.querySelectorAll('[data-opt]').forEach(x=>x.disabled=true);const ok=Number(b.dataset.opt)===correct;if(ok){score++;$('feedback').textContent='🎉 Chính xác!';$('feedback').style.color='#287443'}else{$('feedback').textContent='Chưa chính xác. Đáp án: '+q.correct;$('feedback').style.color='#b34836'}if(q.explanation){const p=document.createElement('p');p.className='muted';p.textContent=q.explanation;$('feedback').after(p)}const n=document.createElement('button');n.className='gold';n.textContent=qpos===qset.length-1?'XEM KẾT QUẢ':'CÂU TIẾP THEO';n.onclick=()=>{qpos++;qpos<qset.length?renderQuestion():finishQuiz()};a.appendChild(n)})}
async function finishQuiz(){window.IKIGAI_DIARY?.study(null);const earned=score*10;const synced=await persistAward();const a=$('activity');a.innerHTML=`<button class="close-activity">×</button><small>IKIGAI WORLD · KẾT QUẢ</small><h2>Hoàn thành thử thách!</h2><div class="question">🏆 ${score}/${qset.length} câu đúng</div><p>${role==='guest'?'Bạn đang chơi chế độ khách; điểm không được lưu.':role==='teacher'?'Tài khoản giáo viên không nhận XP học viên.':synced?`Đã cộng ${lastQuizXp} XP · ${lastQuizCoins} xu vào tài khoản.`:'Chưa cộng thưởng do chưa đồng bộ được dữ liệu.'}</p><button class="gold" id="again">LUYỆN LẠI</button> <button class="secondary" id="done">QUAY LẠI PHÒNG</button>`;a.querySelector('.close-activity').onclick=()=>a.hidden=true;$('again').onclick=()=>startQuiz(activeGroup);$('done').onclick=()=>a.hidden=true}
document.querySelectorAll('[data-menu]').forEach(b=>b.onclick=()=>toast(`${b.dataset.menu}: khu chức năng đang được hoàn thiện.`));
document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>{
 const key=b.dataset.quick;
 if(key==='Bạn bè'){openMembers();return}
 if(key==='Học tập'){backMap();enterPlace('class');return}
 if(key==='Bài thi'){backMap();enterPlace('n5');return}
 toast(`${key}: sẽ mở khi chức năng được kết nối.`);
});
$('logoutBtn').onclick=async()=>{await window.IKIGAI_DIARY?.flush();localStorage.removeItem('ikigaiRememberLogin');window.IKIGAI_JFT_CLASS_LINK?.clear();if(client)await client.auth.signOut();if(channel)await client.removeChannel(channel);location.reload()};
window.addEventListener('beforeunload',()=>{if(client&&channel)client.removeChannel(channel)});
save();updateAvatar();
// IKIGAI 10.4.5 — Hall of Fame: rankings are server-backed and never generated locally.
const hallRankTabs=document.querySelectorAll('[data-rank-tab]');
let hallRankRows=[];
function hallLevel(x){return rankLevel(Number(x)||0)}
function hallTitle(x){return classRanks[hallLevel(x)-1]?.name||'Tân binh'}
function hallPortrait(p){return playerImage(p)}
function hallSafe(v){return safe(String(v??''))}
function renderHallPodium(rows){
 const podium=$('hallPodium');if(!podium)return;
 const order=[1,0,2];
 podium.style.cssText='position:relative!important;display:block!important;flex:1 1 0!important;min-height:0!important;width:100%!important;padding:0!important;box-sizing:border-box!important';
 podium.innerHTML=order.map((index)=>{
  const p=rows[index],rank=index+1;
  if(!p)return `<div class="hall-place empty place-${rank}"><span>✦</span><small>Chưa có hạng ${rank}</small></div>`;
  return `<article class="hall-place place-${rank}">
   <div class="hall-place-glow"></div>
   
   <div class="hall-podium-companions" data-pet-owner="${hallSafe(p.user_id)}"><img src="${hallPortrait(p)}" ${portraitAttrs(p)} alt="Nhân vật ${hallSafe(p.nickname)}"></div>
   <div class="hall-place-step">
    <strong class="hall-medal" aria-label="Hạng ${rank}">${rank}</strong>
    <b class="hall-podium-name" title="${hallSafe(p.nickname)}">${hallSafe(p.nickname)}</b>
    <div class="hall-podium-stats"><b class="hall-level">Lv.${hallLevel(p.xp)}</b><b class="hall-exp">${Number(p.xp||0).toLocaleString('vi-VN')} EXP</b></div>
    <small class="hall-rank-title" title="${hallSafe(hallTitle(p.xp))}">${hallSafe(hallTitle(p.xp))}</small>
   </div>
  </article>`;
 }).join('');
 [...podium.children].forEach((el,i)=>{
  const set=(node,props)=>{if(node)for(const [k,v] of Object.entries(props))node.style.setProperty(k,v,'important')};
  set(el,{position:'absolute',left:(1+i*33)+'%',right:'auto',bottom:'6px',top:'auto',width:'32%',height:i===1?'calc(100% - 6px)':'calc(92% - 6px)',margin:'0',padding:'0',display:'block',transform:'none','box-sizing':'border-box'});
  set(el.querySelector('.hall-place-step'),{position:'absolute',left:'0',right:'0',bottom:'0',top:'auto',width:'100%',height:'54px','max-width':'none',margin:'0',transform:'none','box-sizing':'border-box'});
  set(el.querySelector('.hall-podium-companions'),{position:'absolute',left:'0',right:'0',top:'0',bottom:'54px',width:'100%',height:'auto',margin:'0',transform:'none'});
 });
}
function renderHallList(rows){
 const list=$('worldLeaderboardList');if(!list)return;
 const remaining=rows.slice(3,100);
 list.innerHTML=remaining.length?remaining.map((p,i)=>`<article class="hall-rank-row">
  <b class="hall-rank-number">${i+4}</b>
  <span class="hall-rank-person"><img src="${hallPortrait(p)}" ${portraitAttrs(p)} alt=""><strong title="${hallSafe(p.nickname)}">${hallSafe(p.nickname)}</strong></span>
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
 const progress=rankProgress(myXp);
 $('hallMyXp').textContent+=level===10?(progress.remaining?' · Còn '+progress.remaining.toLocaleString('vi-VN')+' EXP hoàn thành cấp 10':' · Hoàn thành cấp 10'):' · Còn '+progress.remaining.toLocaleString('vi-VN')+' EXP lên Lv.'+(level+1);
 $('hallProgressFill').style.width=progress.percent+'%';
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
  renderHallPodium(hallRankRows);renderHallList(hallRankRows);renderHallSelf(hallRankRows);window.IKIGAI_COSMETICS?.schedule();
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
  session.opponent=data.opponent;
  panel.innerHTML=data.question
   ?`<p>${safe(data.opponent)} · Câu ${Number(data.round)+1}/20</p>
     <div class="arena-battle-question">${safe(data.question.prompt)}</div>${arenaQuestionImage(data.question)}
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
   `${arenaOutcomeNames([{name:data.player_name||nickname}],[{name:data.opponent||session.opponent||'Học viên'}],Number(data.correct),Number(data.opponent_correct),data.outcome)}<p>${safe(data.player_name||nickname)} ${Number(data.correct)}/20 · ${safe(data.opponent||session.opponent||'Học viên')} ${Number(data.opponent_correct)}/20</p>
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


window.IKIGAI_GRAMMAR_CONTEXT=()=>({client,user,role});
const studyRooms=new Set(['class','n5','n4','jft']);
const studyGroupLabels={vocabulary:'TỪ VỰNG',grammar:'NGỮ PHÁP',kanji:'KANJI',kaiwa:'KAIWA'};
let roomQuizRequest=0;

function baseStudyQuestions(room){
 if(room==='class')return [...bank.filter(q=>q.group==='grammar'),...kaiwaStarter.map((q,i)=>({...q,id:'KAIWA-BASE-'+(i+1),group:'kaiwa'}))];
 return room==='n5'?bank:[];
}

async function getStudyQuestions(room){
 const defaults=baseStudyQuestions(room);
 if(!client)return [];
 try{const rows=(await window.IKIGAI_ROOM_QUESTIONS.load(client,room,defaults)).rows;return room==='class'?rows.filter(q=>!['vocabulary','kanji'].includes(q.group)):rows}
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

$('rememberLogin').checked=localStorage.getItem('ikigaiRememberLogin')==='true';
async function restoreRememberedLogin(){
 if(!$('rememberLogin').checked)return;
 for(let i=0;i<40&&!window.supabase;i++)await new Promise(r=>setTimeout(r,250));
 if(!window.supabase||!setup())return;setBusy(true);$('loginStatus').textContent='Đang khôi phục đăng nhập…';
 try{let sessionResult=await client.auth.getSession();if(sessionResult.error)throw sessionResult.error;if(!sessionResult.data.session)throw Object.assign(new Error('Session missing'),{code:'session_not_found'});let {data,error}=await client.auth.getUser();if(error&&expiredAuth(error)){const refreshed=await client.auth.refreshSession();if(refreshed.error)throw refreshed.error;({data,error}=await client.auth.getUser())}if(error)throw error;if(!data.user||data.user.is_anonymous)throw Object.assign(new Error('Session missing'),{code:'session_not_found'});
 user=data.user;role=user.app_metadata?.role==='teacher'?'teacher':'student';nickname=role==='teacher'?window.IKIGAI_TEACHER_LOGIN.displayName(user):user.user_metadata?.nickname||'Học viên';gender=user.user_metadata?.gender||'male';avatar=Number(user.user_metadata?.avatar||0);await enterWorld();
 }catch(e){if(expiredAuth(e)&&!networkAuth(e))clearExpiredAuth();$('loginStatus').textContent=translateError(e);setBusy(false)}
}
restoreRememberedLogin();
})();




