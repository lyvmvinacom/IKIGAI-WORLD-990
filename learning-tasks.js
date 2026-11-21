/* IKIGAI World missions: normal practice rewards, shared lifetime five-attempt cap, no extra mission bonus. */
(function(){
'use strict';
var rooms={class:'🏫 Lớp học IKIGAI',n5:'📗 Phòng N5',n4:'📘 Phòng N4',jft:'🎌 Phòng JFT A2'};
var sources={kotoba:'Từ vựng Minna',bunpou:'Bunpou Tetris',verb:'Chia thể động từ',jft_drill:'Luyện JFT',jft_exam:'Đề thi JFT',n4_exam:'Đề thi N4',kanji_bomb:'Kanji · Gỡ bom',grammar_exam:'Kiểm tra ngữ pháp'};
var allowed={class:['kotoba','bunpou','verb'],n5:['kotoba','bunpou','verb'],n4:['verb','n4_exam'],jft:['jft_drill','jft_exam']};
var hints={kotoba:'minna:12:vocab',bunpou:'minna:12:grammar',verb:'verb:N5:te',jft_drill:'jft:excel-kanji-1-1',jft_exam:'exam:ma-de-jft',n4_exam:'n4:n4-best-1'};
var progressStudent='',progressRoom='all',teacherView='assign';
var context,openRoom,items=[],students=[],catalog=[],opened=false,working=false,filter='all',tick=null,reminded=false;
function el(s){return document.querySelector(s);}
function safe(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function who(){return context?context():{};}
function teacher(){return who().role==='teacher';}
function student(){return who().role==='student';}
function formatDate(x){return x?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(x)):'Không giới hạn';}
async function rpc(n,args){var c=who().client;if(!c)throw Error('Chưa đăng nhập');var r=await c.rpc(n,args||{});if(r.error)throw r.error;return r.data;}
var dock=el('.ik-shop-dock');if(!dock)return;
var trigger=document.createElement('button');trigger.type='button';trigger.className='ik-shop-entry ik-task-entry';trigger.title='Nhiệm vụ học tập';trigger.setAttribute('aria-label','Nhiệm vụ học tập');trigger.innerHTML='<img src="shop/mission.svg?v=20261121-1" alt="Nhiệm vụ" draggable="false"><span class="task-count" aria-hidden="true" hidden></span>';dock.append(trigger);
var style=document.createElement('style');style.textContent=
'.ik-shop-dock .ik-task-entry{position:relative!important;overflow:visible!important;background:transparent!important;border:0!important;box-shadow:none!important;display:block!important}.ik-shop-dock .ik-task-entry[hidden],.ik-task-entry .task-count[hidden]{display:none!important}.ik-task-entry img{width:100%;height:100%;object-fit:contain;display:block}.ik-task-entry .task-count{position:absolute;z-index:2;top:1px;right:0;min-width:clamp(19px,3.5vh,26px);height:clamp(19px,3.5vh,26px);padding:0 4px;box-sizing:border-box;border-radius:999px;background:#f12938;border:1.5px solid #fff;color:#fff;font:800 clamp(11px,2vh,15px)/1 system-ui;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px #0007;pointer-events:none}'+
'#ik-task-panel{position:absolute;inset:0;z-index:2147483001;background:rgba(8,24,38,.98);display:flex;flex-direction:column;color:#f5f4ef;font:13px/1.4 system-ui}#ik-task-panel *{box-sizing:border-box}#ik-task-panel header{display:flex;justify-content:space-between;align-items:center;background:#143c51;padding:8px 13px;border-bottom:1px solid #a89054}#ik-task-panel header b{font-size:15px;color:#ffe2aa}#ik-task-panel main{flex:1;overflow:auto;padding:9px clamp(10px,2vw,25px)}#ik-task-panel button{padding:6px 9px;color:white;background:#20526b;border:1px solid #6c8c9c;border-radius:7px;font:inherit;cursor:pointer}#ik-task-panel button:focus-visible{outline:2px solid #ffe2aa}#ik-task-panel .summary{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:7px}#ik-task-panel .summary span{background:#25465a;padding:5px 9px;border-radius:7px}#ik-task-panel .group{margin:10px 0}#ik-task-panel h3{font-size:14px;color:#ffe1aa;margin:8px 0}'+
'#ik-task-panel .entry{display:flex;gap:10px;align-items:center;justify-content:space-between;border:1px solid #527384;background:#18384c;border-radius:10px;padding:8px;margin:5px 0}#ik-task-panel .entry.complete{border-color:#3b8061}#ik-task-panel .entry.overdue{border-color:#c36b58}#ik-task-panel .details{flex:1;min-width:0}#ik-task-panel .details b,#ik-task-panel .details small{display:block}#ik-task-panel .details small{font-size:11px;opacity:.85}#ik-task-panel .state{color:#ffce86;font-weight:bold}#ik-task-panel .entry.complete .state{color:#8de0b1}#ik-task-panel .actions{display:flex;gap:4px;flex-wrap:wrap}#ik-task-panel .filters{display:flex;gap:5px;margin:8px 0;flex-wrap:wrap}#ik-task-panel .filters button[aria-pressed=true]{background:#137b70}#ik-task-panel .warning{color:#ffe0ad;margin:7px 0}'+
'#ik-task-panel form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;background:#193e52;border:1px solid #6c8c9c;border-radius:10px;padding:9px}#ik-task-panel form label{display:flex;flex-direction:column;gap:3px}#ik-task-panel form input,#ik-task-panel form select{background:#102e40;border:1px solid #86a1ac;border-radius:6px;color:white;padding:6px;width:100%;min-height:33px}#ik-task-panel form button{background:#126961;align-self:end}#ik-task-panel [hidden]{display:none!important}@media(max-width:700px){#ik-task-panel form{grid-template-columns:repeat(2,minmax(0,1fr))}#ik-task-panel .entry{padding:6px}}';style.textContent+=' #ik-task-panel .batch-form{grid-template-columns:minmax(150px,1fr) minmax(240px,1.6fr) minmax(190px,1.3fr);align-items:start;gap:10px}#ik-task-panel .batch-col{min-width:0;border:1px solid #507789;border-radius:8px;background:#102e40;padding:9px}#ik-task-panel .batch-col label{margin:5px 0}#ik-task-panel .batch-scroll{max-height:42vh;overflow:auto;overscroll-behavior:contain}#ik-task-panel details{border:1px solid #42677c;border-radius:8px;margin:6px 0;padding:7px}#ik-task-panel summary{cursor:pointer;color:#ffe2aa;font-weight:bold}#ik-task-panel .batch-pills{display:flex;flex-wrap:wrap;gap:4px}#ik-task-panel .batch-pill{display:flex;flex-direction:row;align-items:center;gap:5px;background:#204e60;padding:4px 7px;border-radius:5px;margin:0}#ik-task-panel .batch-pill:has(input:checked){background:#126d61}#ik-task-panel .batch-pill input{width:16px;min-height:16px;height:16px;accent-color:#1bac8c}#ik-task-panel .batch-cart-group{border:1px solid #42677c;margin:5px 0;border-radius:6px;padding:6px}#ik-task-panel .batch-cart-row{display:flex;justify-content:space-between;align-items:center;gap:5px}#ik-task-panel .batch-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}#ik-task-panel #batch-total{display:block;color:#ffe0a4;margin-top:8px}#ik-task-panel button:disabled{opacity:.5;cursor:default}@media(max-width:720px){#ik-task-panel .batch-form{grid-template-columns:1fr 1.25fr 1fr;gap:4px;padding:4px}#ik-task-panel .batch-col{padding:5px}#ik-task-panel .batch-scroll{max-height:44vh}}@media(max-width:520px){#ik-task-panel .batch-form{grid-template-columns:1fr}}';style.textContent+=' #ik-task-panel .task-tabs{display:flex;gap:6px;margin-bottom:8px}#ik-task-panel .task-tabs button[aria-pressed=true]{background:#14796a;border-color:#75c6ab}#ik-task-panel .progress-box{background:#102e40;border:1px solid #507789;border-radius:9px;padding:9px}#ik-task-panel .progress-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:end}#ik-task-panel .progress-controls label{flex:1;min-width:120px;display:flex;flex-direction:column;gap:3px}#ik-task-panel .progress-controls select{width:100%;background:#102e40;color:white;border:1px solid #86a1ac;border-radius:6px;padding:6px;font:inherit}#ik-task-panel .progress-meter,#ik-task-panel .progress-person i{display:block;height:7px;border-radius:8px;background:#294657;overflow:hidden}#ik-task-panel .progress-meter em,#ik-task-panel .progress-person em{display:block;height:100%;background:#65d2a5;border-radius:8px}#ik-task-panel .progress-roster{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px;margin-top:9px}#ik-task-panel .progress-person{text-align:left;display:flex;flex-direction:column;gap:4px;background:#18384c}#ik-task-panel .progress-person i{width:100%}#ik-task-panel .progress-person span,#ik-task-panel .progress-person small{font-size:11px}';document.head.append(style);
function status(t){return t.completed?'✓ Đã hoàn thành 100%':t.status==='overdue'?'⚠ Quá hạn':t.status==='in_progress'?'⏳ Chưa đạt 100%':'○ Chưa thực hiện';}
function message(s){var p=el('#ik-task-message');if(p)p.textContent=s;}
async function reload(quiet){
 if(!who().user||who().role==='guest')return;
 try{
  var data=await rpc('ikigai_tasks_list');items=Array.isArray(data)?data:[];
  var pending=items.filter(function(t){return !t.completed;});
  var counter=trigger.querySelector('.task-count');counter.hidden=!student()||!pending.length;counter.textContent=pending.length>99?'99+':String(pending.length);trigger.setAttribute('aria-label',student()?'Nhiệm vụ học tập · '+pending.length+' chưa hoàn thành':'Nhiệm vụ học tập');
  if(opened&&(!teacher()||!quiet||teacherView==='progress'))render();
  if(!quiet&&student()&&!reminded){
   var urgent=pending.filter(function(t){return t.status==='overdue'||(t.due_at&&new Date(t.due_at).getTime()-Date.now()<86400000);});
   if(pending.length){reminded=true;var toast=el('#toast');if(toast){toast.textContent=urgent.length?'📋 Có '+urgent.length+' nhiệm vụ quá hạn hoặc sắp đến hạn!':'📋 Bạn còn '+pending.length+' nhiệm vụ học tập chưa hoàn thành.';toast.classList.add('show');setTimeout(function(){toast.classList.remove('show');},4500);}}
  }
 }catch(e){console.warn('Task sync:',e);message('Lỗi tải nhiệm vụ: '+e.message);}
}
function card(t){
 var cls=t.completed?'complete':t.status==='overdue'?'overdue':'';var learner=teacher()?students.find(function(x){return x.user_id===t.student_id;}):null;
 return '<article class="entry '+cls+'"><div class="details"><b>'+safe(t.title)+'</b><small>'+(learner?safe(learner.nickname)+' · ':'')+safe(sources[t.source]||t.source)+' · '+'Hạn '+formatDate(t.due_at)+'</small><small class="state">'+status(t)+' · Cao nhất '+Number(t.best_percent||0)+'% · '+Number(t.attempt_count||0)+' lượt</small></div><div class="actions">'+
 (t.completed?'':'<button type="button" data-open-room="'+safe(t.room)+'">Đến phòng</button>')+
 (teacher()?'<button type="button" data-report="'+safe(t.id)+'">Báo cáo</button><button type="button" data-archive="'+safe(t.id)+'">Ẩn</button>':'')+'</div></article>';
}
var draft={student:'',due:'',room:'all',search:'',selected:new Map()};
function taskKey(t){return t.source+'|'+t.lesson_key;}
function teacherForm(){
 var rs='<option value="all">Tất cả phòng</option>'+Object.keys(rooms).filter(function(k){return catalog.some(function(x){return x.room===k;});}).map(function(k){return '<option value="'+k+'">'+safe(rooms[k])+'</option>';}).join('');
 var ss=students.map(function(x){return '<option value="'+safe(x.user_id)+'">'+safe(x.nickname)+'</option>';}).join('');
 return '<form id="ik-task-form" class="batch-form"><section class="batch-col"><h3>① Thông tin giao nhiệm vụ</h3><label>Học viên<select name="student" required><option value="">Chọn học viên</option>'+ss+'</select></label><label>Phòng (lọc)<select name="room">'+rs+'</select></label><label>Hạn hoàn thành<input name="due" type="datetime-local"></label><p>Chọn nhiều bài ở nhiều phòng. Đổi phòng không mất lựa chọn.</p></section><section class="batch-col"><h3>② Chọn danh mục & bài học</h3><input name="search" type="search" placeholder="Tìm bài học / đề thi"><div id="batch-choices" class="batch-scroll"></div></section><section class="batch-col"><h3>③ Danh sách sẽ giao</h3><div id="batch-cart" class="batch-scroll"></div><strong id="batch-total"></strong><div class="batch-actions"><button type="submit">+ Giao tất cả nhiệm vụ</button><button type="button" id="batch-clear">Xóa lựa chọn</button></div></section></form>';
}
function progressControls(scoped,done){
 var selected=students.find(function(x){return x.user_id===progressStudent;});
 var percent=scoped.length?Math.round(done*100/scoped.length):0;
 var all='<option value="">Tất cả học viên</option>'+students.map(function(x){return '<option value="'+safe(x.user_id)+'" '+(x.user_id===progressStudent?'selected':'')+'>'+safe(x.nickname)+'</option>';}).join('');
 var rr='<option value="all">Tất cả phòng</option>'+Object.keys(rooms).map(function(k){return '<option value="'+k+'" '+(k===progressRoom?'selected':'')+'>'+safe(rooms[k])+'</option>';}).join('');
 var list=progressStudent?'':'<div class="progress-roster">'+students.map(function(x){var rows=items.filter(function(t){return t.student_id===x.user_id&&(progressRoom==='all'||t.room===progressRoom);});var d=rows.filter(function(t){return t.completed;}).length;var late=rows.filter(function(t){return t.status==='overdue';}).length;var p=rows.length?Math.round(d*100/rows.length):0;return '<button type="button" class="progress-person" data-track-student="'+safe(x.user_id)+'"><b>'+safe(x.nickname)+'</b><span>'+d+'/'+rows.length+' hoàn thành · '+p+'%</span><i><em style="width:'+p+'%"></em></i><small>'+(rows.length-d)+' chưa xong · '+late+' quá hạn</small></button>';}).join('')+'</div>';
 return '<section class="progress-box"><div class="progress-controls"><label>Học viên<select id="progress-student">'+all+'</select></label><label>Phòng<select id="progress-room">'+rr+'</select></label><button type="button" id="progress-refresh">↻ Làm mới</button></div><h3>'+safe(selected?selected.nickname:'Toàn bộ học viên')+' · '+percent+'% hoàn thành</h3><div class="progress-meter"><em style="width:'+percent+'%"></em></div>'+list+'</section>';
}
function render(){
 var root=el('#ik-task-content');if(!root)return;
 var tracking=teacher()&&teacherView==='progress';var scoped=tracking?items.filter(function(t){return (!progressStudent||t.student_id===progressStudent)&&(progressRoom==='all'||t.room===progressRoom);}):items;var done=scoped.filter(function(t){return t.completed;}).length,late=scoped.filter(function(t){return t.status==='overdue';}).length;
 var html=(teacher()?'<nav class="task-tabs"><button type="button" data-task-tab="assign" aria-pressed="'+(!tracking)+'">📋 Giao nhiệm vụ</button><button type="button" data-task-tab="progress" aria-pressed="'+tracking+'">📊 Tiến độ học viên</button></nav>':'')+'<div class="summary"><span>📋 Tổng '+scoped.length+'</span><span>✅ Hoàn thành '+done+'</span><span>⏳ Chưa xong '+(scoped.length-done)+'</span><span>⚠ Quá hạn '+late+'</span></div>'+
 '<p class="warning">Nhiệm vụ phải đúng 100% · Luyện lại không giới hạn · EXP và xu theo mức luyện tập thường, tối đa 5 lượt/bài (tính cả các lượt trước khi giao nhiệm vụ).</p>';
 if(teacher()&&!tracking)html+=catalog.length?teacherForm():'<p>Chưa tải được danh mục bài học. Vui lòng đăng nhập lại.</p>';if(tracking)html+=progressControls(scoped,done);
 html+='<nav class="filters">'+[['all','Tất cả'],['pending','Chưa xong'],['done','Đã hoàn thành'],['overdue','Quá hạn']].map(function(a){return '<button type="button" data-filter="'+a[0]+'" aria-pressed="'+(filter===a[0])+'">'+a[1]+'</button>';}).join('')+'</nav>';
 var shown=scoped.filter(function(x){return filter==='all'||(filter==='done'?x.completed:filter==='overdue'?x.status==='overdue':!x.completed);});
 Object.keys(rooms).forEach(function(k){var subset=shown.filter(function(x){return x.room===k;});if(subset.length)html+='<section class="group"><h3>'+rooms[k]+' ('+subset.length+')</h3>'+subset.map(card).join('')+'</section>';});
 if(!shown.length)html+='<p>Chưa có nhiệm vụ ở mục này.</p>';
 html+='<div id="ik-task-report"></div>';root.innerHTML=html;
 root.querySelectorAll('[data-filter]').forEach(function(b){b.onclick=function(){filter=b.dataset.filter;render();};});
 root.querySelectorAll('[data-open-room]').forEach(function(b){b.onclick=function(){var room=b.dataset.openRoom;close();if(openRoom)openRoom(room);};});
 root.querySelectorAll('[data-report]').forEach(function(b){b.onclick=function(){report(b.dataset.report);};});
 root.querySelectorAll('[data-archive]').forEach(function(b){b.onclick=function(){archive(b.dataset.archive);};});
 if(teacher()){root.querySelectorAll('[data-task-tab]').forEach(function(b){b.onclick=function(){teacherView=b.dataset.taskTab;filter='all';render();reload(true);};});if(tracking){el('#progress-student').onchange=function(){progressStudent=this.value;filter='all';render();};el('#progress-room').onchange=function(){progressRoom=this.value;render();};el('#progress-refresh').onclick=function(){reload(false);};root.querySelectorAll('[data-track-student]').forEach(function(b){b.onclick=function(){progressStudent=b.dataset.trackStudent;filter='all';render();};});}else bindTeacher();}
}
function bindTeacher(){
 var form=el('#ik-task-form');if(!form)return;
 var choices=el('#batch-choices'),cart=el('#batch-cart'),total=el('#batch-total'),submit=form.querySelector('button[type=submit]');
 form.elements.student.value=draft.student;form.elements.due.value=draft.due;form.elements.room.value=draft.room;form.elements.search.value=draft.search;
 function groups(rows){var grouped=new Map();rows.forEach(function(t){var k=t.room+'|'+t.category;if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(t);});return Array.from(grouped.values());}
 function draw(){
  var term=draft.search.trim().toLocaleLowerCase('vi'),rows=catalog.filter(function(t){return (draft.room==='all'||t.room===draft.room)&&(!term||(t.category+' '+t.title+' '+rooms[t.room]).toLocaleLowerCase('vi').includes(term));});
  choices.innerHTML=groups(rows).map(function(g,i){var n=g.filter(function(t){return draft.selected.has(taskKey(t));}).length;return '<details open><summary>'+safe(rooms[g[0].room])+' · '+safe(g[0].category)+' ('+n+'/'+g.length+')</summary><button type="button" data-all="'+i+'">'+(n===g.length?'Bỏ chọn nhóm':'Chọn cả nhóm')+'</button><div class="batch-pills">'+g.map(function(t){var k=taskKey(t);return '<label class="batch-pill"><input type="checkbox" data-key="'+safe(k)+'" '+(draft.selected.has(k)?'checked':'')+'>'+safe(t.title)+'</label>';}).join('')+'</div></details>';}).join('')||'<p>Không tìm thấy bài.</p>';
  var gs=groups(rows);
  choices.querySelectorAll('[data-all]').forEach(function(btn){btn.onclick=function(){var g=gs[+btn.dataset.all],all=g.every(function(t){return draft.selected.has(taskKey(t));});g.forEach(function(t){if(all)draft.selected.delete(taskKey(t));else draft.selected.set(taskKey(t),t);});draw();};});
  choices.querySelectorAll('[data-key]').forEach(function(cb){cb.onchange=function(){var t=rows.find(function(r){return taskKey(r)===cb.dataset.key;});if(cb.checked)draft.selected.set(taskKey(t),t);else draft.selected.delete(taskKey(t));draw();};});
  cart.innerHTML=groups(Array.from(draft.selected.values())).map(function(g){return '<div class="batch-cart-group"><b>'+safe(g[0].category)+' ('+g.length+')</b>'+g.map(function(t){return '<div class="batch-cart-row"><span>'+safe(t.title)+'</span><button type="button" data-remove="'+safe(taskKey(t))+'" aria-label="Bỏ '+safe(t.title)+'">×</button></div>';}).join('')+'</div>';}).join('')||'<p>Chưa chọn bài nào.</p>';
  cart.querySelectorAll('[data-remove]').forEach(function(btn){btn.onclick=function(){draft.selected.delete(btn.dataset.remove);draw();};});
  total.textContent='Tổng cộng: '+draft.selected.size+' nhiệm vụ';submit.disabled=working||!draft.selected.size||!draft.student;
 }
 form.elements.student.onchange=function(){draft.student=this.value;draw();};form.elements.due.onchange=function(){draft.due=this.value;};form.elements.room.onchange=function(){draft.room=this.value;draw();};form.elements.search.oninput=function(){draft.search=this.value;draw();};
 el('#batch-clear').onclick=function(){draft.selected.clear();draw();};draw();
 form.onsubmit=async function(e){e.preventDefault();if(working||!draft.selected.size||!draft.student)return;
  if(!confirm('Giao '+draft.selected.size+' nhiệm vụ cho học viên đã chọn?'))return;
  working=true;submit.disabled=true;submit.textContent='Đang giao…';
  try{var payload=Array.from(draft.selected.values()).map(function(t){return {room:t.room,source:t.source,lesson_key:t.lesson_key};});
   var result=await rpc('ikigai_tasks_batch',{p_student_id:draft.student,p_due_at:draft.due?new Date(draft.due).toISOString():null,p_tasks:payload});
   draft.selected.clear();await reload(true);render();message('✓ Đã giao '+result.added+' nhiệm vụ; bỏ qua '+result.skipped+' bài trùng.');
  }catch(error){message('Không giao được nhiệm vụ: '+error.message);}
  finally{working=false;submit.textContent='+ Giao tất cả nhiệm vụ';if(form.isConnected)draw();else{var next=el('#ik-task-form button[type=submit]');if(next)next.disabled=!draft.selected.size||!draft.student;}}
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
 layer.innerHTML='<header><b>📋 NHIỆM VỤ HỌC TẬP · IKIGAI WORLD</b><div style="display:flex;gap:5px;align-items:center">'+(teacher()?'<button id="ik-task-progress-top" style="background:#14796a;border-color:#75c6ab;font-weight:bold">📊 Tiến độ học viên</button>':'')+'<button id="ik-task-close">✕ Đóng</button></div></header><main><p id="ik-task-message" role="status"></p><div id="ik-task-content">Đang tải…</div></main>';
 (el('#game')||document.body).append(layer);el('#ik-task-close').onclick=close;var topProgress=el('#ik-task-progress-top');if(topProgress)topProgress.onclick=function(){teacherView='progress';filter='all';render();el('#ik-task-panel main').scrollTop=0;reload(true);};document.addEventListener('keydown',keydown);render();reload(true);el('#ik-task-close').focus();
}
async function init(get,nav){
 context=get;openRoom=nav;items=[];students=[];reminded=false;progressStudent='';progressRoom='all';teacherView='assign';filter='all';draft={student:'',due:'',room:'all',search:'',selected:new Map()};
 trigger.hidden=who().role==='guest';if(who().role==='guest')return;
 if(teacher()){try{var data=await Promise.all([rpc('ikigai_tasks_students'),rpc('ikigai_tasks_catalog')]);students=data[0]||[];catalog=data[1]||[];}catch(e){console.warn('Task catalog:',e);}}
 await reload(false);
 if(tick)clearInterval(tick);tick=setInterval(function(){if(!document.hidden&&who().user)reload(true);},15000);
}
var mapScene=el('#mapScene');if(mapScene)new MutationObserver(function(){if(!mapScene.hidden&&student()&&who().user)reload(true);}).observe(mapScene,{attributes:true,attributeFilter:['hidden']});
document.addEventListener('visibilitychange',function(){if(!document.hidden&&student()&&who().user)reload(true);});
trigger.onclick=open;
window.IKIGAI_TASKS={init:init,refresh:reload,open:open};
})();