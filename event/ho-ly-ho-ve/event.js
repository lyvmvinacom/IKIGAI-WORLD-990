/* Optional seasonal module. Remove its script tag to remove the entire event UI. */
(()=>{'use strict';
 const ENABLED=true;
 if(!ENABLED)return;
 const root=new URL('./',document.currentScript.src);
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('event.css?v=3-compact',root);document.head.append(css);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=n=>Number(n||0).toLocaleString('vi-VN');
 let context=()=>({}),panel=null,trigger=null,timer=null,busy=false,seq=0,tab='ranking',snapshot=null,previous=null,clockOffset=0;
 const rewards='<div class="fox-prizes"><article><b>🥇 Hạng 1 · 5.000 xu</b><p>Cáo Linh Hỏa Vàng</p><p>Chọn 1 nhân vật: Akatsuki hoặc Akari</p></article><article><b>🥈 Hạng 2 · 3.000 xu</b><p>Cáo Linh Hỏa Bạc</p></article><article><b>🥉 Hạng 3 · 2.000 xu</b><p>Cáo Linh Hỏa Đồng</p></article></div>';
 function mount(){
  if(panel)return;
  const tools=document.querySelector('#mapScene');if(!tools)return;
  trigger=document.createElement('button');trigger.type='button';trigger.id='openFoxEvent';trigger.setAttribute('aria-label','Event Hồ Ly Hộ Vệ · Xếp hạng và phần thưởng');trigger.innerHTML='<img class="fox-entry-emblem" src="'+new URL('emblem.svg?v=1',root).href+'" alt="" aria-hidden="true" draggable="false"><span class="fox-entry-copy"><span class="fox-entry-season">EVENT <i>•</i> MÙA 01</span><strong>HỒ LY HỘ VỆ</strong><span class="fox-entry-caption">TRANH TÀI · RINH THƯỞNG</span></span>';trigger.setAttribute('aria-haspopup','dialog');tools.append(trigger);trigger.onclick=open;
  panel=document.createElement('section');panel.id='foxEvent';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','foxEventTitle');
  panel.innerHTML='<header><div><small>IKIGAI EDUCATION · EVENT MÙA 01</small><h2 id="foxEventTitle">🦊 Hồ Ly Hộ Vệ</h2></div><button type="button" data-close aria-label="Đóng event">Đóng ×</button></header><nav aria-label="Nội dung event"><button type="button" data-tab="ranking">🏆 Xếp hạng event</button><button type="button" data-tab="info">🎁 Thông tin & phần thưởng</button><button type="button" data-refresh>Tải lại</button></nav><div class="fox-body"><p class="fox-status" role="status" aria-live="polite"></p><div class="fox-ranking"></div><div class="fox-info" hidden><p class="fox-dates"><b>00:00 ngày 22/11 – 24:00 ngày 24/11/2026</b><br>Giờ Việt Nam · Một bảng chung cho toàn bộ học viên</p>'+rewards+'<p>Học tập và chơi game để kiếm EXP. Chỉ tính EXP mới trong thời gian event, không tính EXP cũ hoặc EXP cộng tặng.</p><p>Kết thúc event, 3 học viên có EXP event cao nhất nhận thưởng. Bằng EXP: người đạt mức đó sớm hơn xếp trên.</p><p>Nhân vật và thú cưng sở hữu vĩnh viễn, không bán trong Shop. Phần thưởng được trao sau khi kiểm tra kết quả; hạng 1 chọn một nhân vật.</p><p>Tự học, tự chơi bằng tài khoản của mình. Không chơi hộ hoặc lợi dụng lỗi để tăng điểm.</p><p>Thưởng học tập giữ quy định chung: tối đa 5 lượt nhận thưởng cho từng bài, không làm mới; dưới 50% không nhận EXP và xu.</p><details><summary>Xem poster phần thưởng</summary><img class="fox-poster" loading="lazy" alt="Poster Hồ Ly Hộ Vệ: phần thưởng hạng 1, 2, 3" src="'+new URL('poster.png',root).href+'"></details></div></div>';
  (document.querySelector('main')||document.body).append(panel);
  panel.querySelector('[data-close]').onclick=close;
  panel.querySelector('[data-refresh]').onclick=()=>load();
  panel.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;paintTabs()});
  panel.addEventListener('keydown',e=>{
   e.stopPropagation();
   if(e.key==='Escape'){e.preventDefault();close();return}
   if(e.key!=='Tab')return;
   const nodes=[...panel.querySelectorAll('button,summary,a,input,select')].filter(n=>!n.closest('[hidden]'));
   if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus()}
   else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus()}
  });paintTabs();
 }
 function paintTabs(){if(!panel)return;panel.querySelector('.fox-ranking').hidden=tab!=='ranking';panel.querySelector('.fox-info').hidden=tab!=='info';panel.querySelector('[data-refresh]').hidden=tab!=='ranking';panel.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)))}
 function render(data){
  snapshot=data;clockOffset=Date.parse(data.server_time)-Date.now();
  const status=panel.querySelector('.fox-status');
  status.textContent=(data.status==='upcoming'?'Sắp diễn ra':data.status==='ended'?'Đã kết thúc · Kết quả chờ kiểm tra':'Đang diễn ra')+' · Tự cập nhật mỗi 10 giây · '+new Date(data.server_time).toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
  const me=data.me;
  const mine=context().role==='teacher'?'Giáo viên xem kết quả, không tham gia xếp hạng.':me?'Vị trí của bạn: #'+me.rank+' · '+num(me.event_xp)+' EXP event':'Bạn chưa có EXP event · Hoàn thành bài học còn lượt thưởng để tham gia.';
  const list=Array.isArray(data.leaderboard)?data.leaderboard:[];
  panel.querySelector('.fox-ranking').innerHTML='<p class="fox-me">'+esc(mine)+'</p><p class="fox-note">EXP event được tính riêng với EXP tổng. Hạng và phần thưởng còn thay đổi đến khi kết thúc.</p>'+(list.length?'<table><thead><tr><th scope="col">Hạng</th><th scope="col">Học viên</th><th scope="col">EXP event</th></tr></thead><tbody>'+list.map(r=>'<tr class="'+(r.user_id===context().user?.id?'fox-self ':'')+(Number(r.rank)<=3?'fox-top':'')+'"><td>'+(['','🥇','🥈','🥉'][Number(r.rank)]||'#'+num(r.rank))+'</td><td>'+esc(r.nickname||'Học viên')+'</td><td>'+num(r.event_xp)+'</td></tr>').join('')+'</tbody></table>':'<p class="fox-empty">Chưa có học viên nhận EXP trong event.</p>');
 }
 async function load(){
  if(!panel||panel.hidden||busy||document.hidden)return;
  const c=context();if(!c.client||!c.user||c.role==='guest')return;
  const request=seq;busy=true;const button=panel.querySelector('[data-refresh]');button.disabled=true;
  try{const {data,error}=await c.client.rpc('ikigai_event_ho_ly_state');if(error)throw error;if(request!==seq||panel.hidden)return;render(data)}
  catch(e){if(request===seq&&!panel.hidden)panel.querySelector('.fox-status').textContent='Chưa tải được xếp hạng. Sẽ tự thử lại; bạn có thể bấm Tải lại.'}
  finally{busy=false;button.disabled=false}
 }
 function open(){
  const c=context();if(!panel||!c.user||c.role==='guest')return;
  previous=document.activeElement;panel.hidden=false;panel.querySelector('[data-close]').focus();
  if(snapshot)render({...snapshot,server_time:new Date(Date.now()+clockOffset).toISOString()});
  panel.querySelector('.fox-status').textContent='Đang tải bảng xếp hạng event…';void load();clearInterval(timer);timer=setInterval(load,10000);
 }
 function close(){if(!panel)return;seq++;panel.hidden=true;clearInterval(timer);timer=null;previous?.focus()}
 window.IKIGAI_FOX_EVENT={init(get){context=get;mount();if(trigger)trigger.hidden=context().role==='guest'},open,close};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load()});
})();
