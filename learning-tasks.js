/* IKIGAI World missions: no EXP, no coins. Progress is read from server-graded attempts. */
(function(){
'use strict';
var rooms={class:'🏫 Lớp học IKIGAI',n5:'📗 Phòng N5',n4:'📘 Phòng N4',jft:'🎌 Phòng JFT A2'};
var sources={kotoba:'Từ vựng Minna',bunpou:'Bunpou Tetris',verb:'Chia thể động từ',jft_drill:'Luyện JFT',jft_exam:'Đề thi JFT',n4_exam:'Đề thi N4'};
var allowed={class:['kotoba','bunpou','verb'],n5:['kotoba','bunpou','verb'],n4:['verb','n4_exam'],jft:['jft_drill','jft_exam']};
var hints={kotoba:'minna:12:vocab',bunpou:'minna:12:grammar',verb:'verb:N5:te',jft_drill:'jft:excel-kanji-1-1',jft_exam:'exam:ma-de-jft',n4_exam:'n4:n4-best-1'};
var context,openRoom,items=[],students=[],opened=false,working=false,filter='all',tick=null,reminded=false;
function el(s){return document.querySelector(s);}
function safe(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function who(){return context?context():{};}
function teacher(){return who().role==='teacher';}
function student(){return who().role==='student';}
function formatDate(x){return x?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(x)):'Không giới hạn';}
async function rpc(n,args){var c=who().client;if(!c)throw Error('Chưa đăng nhập');var r=await c.rpc(n,args||{});if(r.error)throw r.error;return r.data;}
var dock=el('.ik-shop-dock');if(!dock)return;
var trigger=document.createElement('button');trigger.type='button';trigger.className='ik-shop-entry ik-task-entry';trigger.title='Nhiệm vụ học tập';trigger.setAttribute('aria-label','Nhiệm vụ học tập');trigger.innerHTML='<span class="task-icon">📋</span><span class="task-name">NHIỆM VỤ</span><span class="task-count" hidden></span>';dock.append(trigger);
var style=document.createElement('style');style.textContent=
'.ik-task-entry{position:relative!important;display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:1px;border-radius:12px!important;background:linear-gradient(140deg,#155062,#102e43)!important;border:1px solid #bba269!important}.ik-task-entry .task-icon{font-size:clamp(22px,5vh,32px)}.ik-task-entry .task-name{font-size:clamp(8px,1.5vh,10px);color:#ffe4af}.ik-task-entry .task-count{position:absolute;top:-7px;right:-6px;min-width:20px;height:20px;border-radius:20px;background:#bc344a;border:1px solid white;color:white;font:bold 11px/19px system-ui}'+
'#ik-task-panel{position:absolute;inset:0;z-index:2147483001;background:rgba(8,24,38,.98);display:flex;flex-direction:column;color:#f5f4ef;font:13px/1.4 system-ui}#ik-task-panel *{box-sizing:border-box}#ik-task-panel header{display:flex;justify-content:space-between;align-items:center;background:#143c51;padding:8px 13px;border-bottom:1px solid #a89054}#ik-task-panel header b{font-size:15px;color:#ffe2aa}#ik-task-panel main{flex:1;overflow:auto;padding:9px clamp(10px,2vw,25px)}#ik-task-panel button{padding:6px 9px;color:white;background:#20526b;border:1px solid #6c8c9c;border-radius:7px;font:inherit;cursor:pointer}#ik-task-panel button:focus-visible{outline:2px solid #ffe2aa}#ik-task-panel .summary{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:7px}#ik-task-panel .summary span{background:#25465a;padding:5px 9px;border-radius:7px}#ik-task-panel .group{margin:10px 0}#ik-task-panel h3{font-size:14px;color:#ffe1aa;margin:8px 0}'+
'#ik-task-panel .entry{display:flex;gap:10px;align-items:center;justify-content:space-between;border:1px solid #527384;background:#18384c;border-radius:10px;padding:8px;margin:5px 0}#ik-task-panel .entry.complete{border-color:#3b8061}#ik-task-panel .entry.overdue{border-color:#c36b58}#ik-task-panel .details{flex:1;min-width:0}#ik-task-panel .details b,#ik-task-panel .details small{display:block}#ik-task-panel .details small{font-size:11px;opacity:.85}#ik-task-panel .state{color:#ffce86;font-weight:bold}#ik-task-panel .entry.complete .state{color:#8de0b1}#ik-task-panel .actions{display:flex;gap:4px;flex-wrap:wrap}#ik-task-panel .filters{display:flex;gap:5px;margin:8px 0;flex-wrap:wrap}#ik-task-panel .filters button[aria-pressed=true]{background:#137b70}#ik-task-panel .warning{color:#ffe0ad;margin:7px 0}'+
'#ik-task-panel form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;background:#193e52;border:1px solid #6c8c9c;border-radius:10px;padding:9px}#ik-task-panel form label{display:flex;flex-direction:column;gap:3px}#ik-task-panel form input,#ik-task-panel form select{background:#102e40;border:1px solid #86a1ac;border-radius:6px;color:white;padding:6px;width:100%;min-height:33px}#ik-task-panel form button{background:#126961;align-self:end}#ik-task-panel [hidden]{display:none!important}@media(max-width:700px){#ik-task-panel form{grid-template-columns:repeat(2,minmax(0,1fr))}#ik-task-panel .entry{padding:6px}}';document.head.append(style);
function status(t){return t.completed?'✓ Đã hoàn thành 100%':t.status==='overdue'?'⚠ Quá hạn':t.status==='in_progress'?'⏳ Chưa đạt 100%':'○ Chưa thực hiện';}
function message(s){var p=el('#ik-task-message');if(p)p.textContent=s;}
async function reload(quiet){
 if(!who().user||who().role==='guest')return;
 try{
  var data=await rpc('ikigai_tasks_list');items=Array.isArray(data)?data:[];
  var pending=items.filter(function(t){return !t.completed;});
  var counter=trigger.querySelector('.task-count');counter.hidden=!pending.length;counter.textContent=pending.length>99?'99+':String(pending.length);
  if(opened)render();
  if(!quiet&&student()&&!reminded){
   var urgent=pending.filter(function(t){return t.status==='overdue'||(t.due_at&&new Date(t.due_at).getTime()-Date.now()<86400000);});
   if(urgent.length){reminded=true;var toast=el('#toast');if(toast){toast.textContent='📋 Có '+urgent.length+' nhiệm vụ quá hạn hoặc sắp đến hạn!';toast.classList.add('show');setTimeout(function(){toast.classList.remove('show');},4500);}}
  }
 }catch(e){console.warn('Task sync:',e);message('Lỗi tải nhiệm vụ: '+e.message);}
}
function card(t){
 var cls=t.completed?'complete':t.status==='overdue'?'overdue':'';
 return '<article class="entry '+cls+'"><div class="details"><b>'+safe(t.title)+'</b><small>'+safe(sources[t.source]||t.source)+' · '+safe(t.lesson_key)+' · Hạn '+formatDate(t.due_at)+'</small><small class="state">'+status(t)+' · Cao nhất '+Number(t.best_percent||0)+'% · '+Number(t.attempt_count||0)+' lượt</small></div><div class="actions">'+
 (t.completed?'':'<button type="button" data-open-room="'+safe(t.room)+'">Đến phòng</button>')+
 (teacher()?'<button type="button" data-report="'+safe(t.id)+'">Báo cáo</button><button type="button" data-archive="'+safe(t.id)+'">Ẩn</button>':'')+'</div></article>';
}
function teacherForm(){
 var rs=Object.keys(rooms).map(function(k){return '<option value="'+k+'">'+safe(rooms[k])+'</option>';}).join('');
 var ss=students.map(function(x){return '<option value="'+safe(x.user_id)+'">'+safe(x.nickname)+'</option>';}).join('');
 return '<form id="ik-task-form"><label>Phòng<select name="room">'+rs+'</select></label><label>Bài học<select name="source"></select></label><label>Mã bài<input name="lesson" required placeholder="minna:12:vocab"></label><label>Tên nhiệm vụ<input name="title" required maxlength="120"></label><label>Hạn hoàn thành<input name="due" type="datetime-local"></label><label>Giao cho<select name="student"><option value="">Tất cả học viên</option>'+ss+'</select></label><button type="submit">+ Giao nhiệm vụ</button></form>';
}
function render(){
 var root=el('#ik-task-content');if(!root)return;
 var done=items.filter(function(t){return t.completed;}).length,late=items.filter(function(t){return t.status==='overdue';}).length;
 var html='<div class="summary"><span>📋 Tổng '+items.length+'</span><span>✅ Hoàn thành '+done+'</span><span>⏳ Chưa xong '+(items.length-done)+'</span><span>⚠ Quá hạn '+late+'</span></div>'+
 '<p class="warning">Nhiệm vụ phải đúng 100% · Không giới hạn lượt làm lại · Không có EXP hoặc xu dành riêng cho nhiệm vụ.</p>';
 if(teacher())html+=teacherForm();
 html+='<nav class="filters">'+[['all','Tất cả'],['pending','Chưa xong'],['done','Đã hoàn thành']].map(function(a){return '<button type="button" data-filter="'+a[0]+'" aria-pressed="'+(filter===a[0])+'">'+a[1]+'</button>';}).join('')+'</nav>';
 var shown=items.filter(function(x){return filter==='all'||(filter==='done'?x.completed:!x.completed);});
 Object.keys(rooms).forEach(function(k){var subset=shown.filter(function(x){return x.room===k;});if(subset.length)html+='<section class="group"><h3>'+rooms[k]+' ('+subset.length+')</h3>'+subset.map(card).join('')+'</section>';});
 if(!shown.length)html+='<p>Chưa có nhiệm vụ ở mục này.</p>';
 html+='<div id="ik-task-report"></div>';root.innerHTML=html;
 root.querySelectorAll('[data-filter]').forEach(function(b){b.onclick=function(){filter=b.dataset.filter;render();};});
 root.querySelectorAll('[data-open-room]').forEach(function(b){b.onclick=function(){var room=b.dataset.openRoom;close();if(openRoom)openRoom(room);};});
 root.querySelectorAll('[data-report]').forEach(function(b){b.onclick=function(){report(b.dataset.report);};});
 root.querySelectorAll('[data-archive]').forEach(function(b){b.onclick=function(){archive(b.dataset.archive);};});
 if(teacher())bindTeacher();
}
function bindTeacher(){
 var form=el('#ik-task-form');if(!form)return;
 function update(){var room=form.elements.room.value,src=form.elements.source,chosen=src.value;src.innerHTML=(allowed[room]||[]).map(function(k){return '<option value="'+k+'">'+sources[k]+'</option>';}).join('');if(allowed[room].includes(chosen))src.value=chosen;form.elements.lesson.placeholder=hints[src.value]||'Mã bài';}
 form.elements.room.onchange=update;form.elements.source.onchange=function(){form.elements.lesson.placeholder=hints[form.elements.source.value]||'Mã bài';};update();
 form.onsubmit=async function(e){
  e.preventDefault();if(working)return;working=true;
  try{
   await rpc('ikigai_tasks_save',{p_id:null,p_room:form.elements.room.value,p_source:form.elements.source.value,p_lesson_key:form.elements.lesson.value.trim(),
    p_title:form.elements.title.value.trim(),p_due_at:form.elements.due.value?new Date(form.elements.due.value).toISOString():null,p_student_id:form.elements.student.value||null});
   await reload(true);message('Đã giao nhiệm vụ.');
  }catch(error){message('Không giao được nhiệm vụ: '+error.message);}
  finally{working=false;}
 };
}
async function report(id){
 var root=el('#ik-task-report');if(!root)return;root.textContent='Đang tải báo cáo…';
 try{var data=await rpc('ikigai_tasks_report',{p_id:id});root.innerHTML='<h3>Báo cáo học viên</h3>'+data.map(function(x){return '<p>'+(x.completed?'✅':'⏳')+' '+safe(x.nickname)+' · '+Number(x.best_percent||0)+'% · '+Number(x.attempt_count||0)+' lượt</p>';}).join('');}
 catch(e){root.textContent=e.message;}
}
async function archive(id){
 if(!confirm('Ẩn nhiệm vụ này khỏi danh sách học viên?'))return;
 try{await rpc('ikigai_tasks_archive',{p_id:id});await reload(true);message('Đã ẩn nhiệm vụ.');}catch(e){message(e.message);}
}
function keydown(e){if(e.key==='Escape'){e.preventDefault();close();}}
function close(){var layer=el('#ik-task-panel');if(layer)layer.remove();opened=false;document.removeEventListener('keydown',keydown);trigger.focus();}
function open(){
 if(opened)return;opened=true;
 var layer=document.createElement('section');layer.id='ik-task-panel';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');
 layer.innerHTML='<header><b>📋 NHIỆM VỤ HỌC TẬP · IKIGAI WORLD</b><button id="ik-task-close">✕ Đóng</button></header><main><p id="ik-task-message" role="status"></p><div id="ik-task-content">Đang tải…</div></main>';
 (el('#game')||document.body).append(layer);el('#ik-task-close').onclick=close;document.addEventListener('keydown',keydown);render();reload(true);el('#ik-task-close').focus();
}
async function init(get,nav){
 context=get;openRoom=nav;items=[];students=[];reminded=false;
 trigger.hidden=who().role==='guest';if(who().role==='guest')return;
 if(teacher()){try{students=await rpc('ikigai_tasks_students');}catch(e){console.warn('Task users:',e);}}
 await reload(false);
 if(tick)clearInterval(tick);tick=setInterval(function(){if(!document.hidden&&who().user)reload(true);},60000);
}
trigger.onclick=open;
window.IKIGAI_TASKS={init:init,refresh:reload,open:open};
})();