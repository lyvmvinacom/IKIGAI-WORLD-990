(()=>{'use strict';
const $=id=>document.getElementById(id),safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let context=()=>({}),records=[],loading=false,deciding=false,timer=null,generation=0,previous=null;
const teacher=()=>{const c=context();return c.role==='teacher'&&c.user?.app_metadata?.role==='teacher'};
const shown=()=>!$('accountApproval').hidden;
const DAY=86400000;
const activityAt=r=>r.last_activity_at||null;
function inactive(r,filter){if(filter==='all')return true;if(r.is_online)return false;const last=activityAt(r);if(filter==='never')return !last;const base=last||r.requested_at;return !!base&&Date.now()-Date.parse(base)>=Number(filter)*DAY}
const date=v=>v?new Date(v).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—';
function status(text,error=false){const el=$('approvalStatus');el.textContent=text;el.classList.toggle('approval-error',error)}
function badge(){const n=records.filter(r=>r.status==='pending').length;const b=$('approvalCount');b.textContent=String(n);b.hidden=!n;$('openAccountApproval').setAttribute('aria-label','Duyệt tài khoản'+(n?' · '+n+' yêu cầu chờ duyệt':''));}
function render(){
 if(!teacher())return close();const tab=$('approvalFilter').value,query=$('approvalSearch').value.trim().toLocaleLowerCase('vi');
 const list=records.filter(r=>(tab==='all'||r.status===tab)&&inactive(r,$('approvalInactive').value)&&(r.nickname+' '+r.email).toLocaleLowerCase('vi').includes(query));
 const scroll=$('approvalList').scrollTop;
 $('approvalList').innerHTML=list.length?list.map(r=>{
  const last=activityAt(r),info=r.is_online?'● Đang hoạt động':last?'Hoạt động gần nhất: '+date(last):'Chưa ghi nhận đăng nhập / hoạt động';
  const days=last?Math.max(0,Math.floor((Date.now()-Date.parse(last))/DAY)):null;
  const actions=r.status==='approved'?'<span class="approval-approved">Đã duyệt</span>':'<button type="button" class="approval-accept" data-id="'+safe(r.user_id)+'" data-decision="approved" '+(deciding?'disabled':'')+'>Phê duyệt</button>'+(r.status==='pending'?'<button type="button" data-id="'+safe(r.user_id)+'" data-decision="rejected" '+(deciding?'disabled':'')+'>Từ chối</button>':'<span>Đã từ chối</span>');
  return '<article class="approval-row"><div><h3>'+safe(r.nickname)+'</h3><p>'+safe(r.email)+'</p><small>Gửi yêu cầu: '+safe(date(r.requested_at))+(r.reviewed_at?' · Xử lý: '+safe(date(r.reviewed_at)):'')+'</small><p class="approval-activity'+(r.is_online?' approval-online':'')+'">'+safe(info)+(days>0?' · '+days+' ngày trước':'')+'</p></div><div class="approval-actions">'+actions+'<button type="button" class="approval-delete" data-delete="'+safe(r.user_id)+'" '+(deciding||r.is_online?'disabled':'')+' title="'+(r.is_online?'Không thể xoá tài khoản đang hoạt động':'Xoá tài khoản và dữ liệu học tập')+'">Xoá tài khoản</button></div></article>';
 }).join(''):'<p class="approval-empty">Không có tài khoản phù hợp với bộ lọc.</p>';
 $('approvalList').scrollTop=scroll;$('approvalList').querySelectorAll('[data-decision]').forEach(b=>b.onclick=()=>review(b.dataset.id,b.dataset.decision));
 $('approvalList').querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>removeAccount(b.dataset.delete));badge();
}
async function removeAccount(id){
 if(!teacher()||deciding)return;const row=records.find(r=>r.user_id===id);if(!row||row.is_online)return;
 // Freeze polling while confirmation is open, preserving the activity snapshot.
 const seq=generation,expected=activityAt(row);deciding=true;render();
 const email=window.prompt('Xoá vĩnh viễn tài khoản '+row.nickname+' ('+row.email+')?\nEXP, xu, vật phẩm, nhiệm vụ và lịch sử học của tài khoản sẽ bị xoá. Không thể hoàn tác.\nNhập lại email của tài khoản để xác nhận:', '');
 if(email===null){deciding=false;render();return}
 if(email.trim().toLowerCase()!==row.email.toLowerCase()){deciding=false;render();status('Email xác nhận không khớp. Chưa xoá tài khoản.',true);return}
 status('Đang xoá tài khoản '+row.nickname+'…');
 try{
  const {data,error}=await context().client.rpc('ikigai_registration_delete',{p_user_id:id,p_confirm_email:email.trim(),p_expected_last_activity:expected});
  if(error)throw error;if(seq!==generation||!teacher())return;
  if(data?.user_id!==id||data.deleted!==true)throw Error('Chưa xác nhận được kết quả xoá. Hãy tải lại danh sách.');
  records=records.filter(r=>r.user_id!==id);deciding=false;render();status('Đã xoá tài khoản: '+row.nickname);
 }catch(e){if(seq===generation&&teacher()){deciding=false;render();status('Chưa xoá được: '+e.message,true)}}finally{deciding=false}
}
async function load(quiet=false){
 if(!teacher()||loading||deciding)return;const seq=generation;loading=true;
 if(shown()&&!quiet)status('Đang tải yêu cầu đăng ký…');
 try{const {data,error}=await context().client.rpc('ikigai_registration_list');if(error)throw error;if(seq!==generation||!teacher())return;if(!Array.isArray(data))throw Error('Chưa nhận được danh sách hợp lệ.');records=data;badge();if(shown()){render();status('Đã cập nhật lúc '+new Date().toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}));}}
 catch(e){if(seq===generation&&shown())status('Chưa tải được: '+e.message,true)}finally{loading=false}
}
async function review(id,decision){
 if(!teacher()||deciding)return;const row=records.find(r=>r.user_id===id);if(!row)return;
 deciding=true;render();status('Đang xử lý '+row.nickname+'…');
 try{const {data,error}=await context().client.rpc('ikigai_registration_review',{p_user_id:id,p_decision:decision});if(error)throw error;if(!teacher())return;if(data?.user_id!==id||data.status!==decision)throw Error('Chưa xác nhận được kết quả phê duyệt.');Object.assign(row,data);deciding=false;render();status((decision==='approved'?'Đã phê duyệt: ':'Đã từ chối: ')+row.nickname);}
 catch(e){deciding=false;render();status('Chưa xử lý được: '+e.message,true)}
}
function close(){$('accountApproval').hidden=true;previous?.focus()}
function open(){if(!teacher())return;previous=document.activeElement;$('accountApproval').hidden=false;$('approvalClose').focus();render();load()}
window.IKIGAI_APPROVALS=Object.freeze({init(getContext){generation++;context=getContext;clearInterval(timer);$('openAccountApproval').hidden=!teacher();if(!teacher()){records=[];badge();close()}if(teacher()){load(true);timer=setInterval(()=>{if(document.visibilityState==='visible')load(true)},10000)}}});
$('openAccountApproval').onclick=open;$('approvalClose').onclick=close;$('approvalRefresh').onclick=()=>load();$('approvalSearch').oninput=render;$('approvalFilter').onchange=render;$('approvalInactive').onchange=render;
$('accountApproval').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close()}if(e.key==='Tab'){const ns=[...$('accountApproval').querySelectorAll('button,input,select')].filter(n=>!n.disabled&&!n.closest('[hidden]')),first=ns[0],last=ns.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
})();
