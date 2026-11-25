// Entry guard for standalone game pages. Server RPC/Storage access is checked separately.
(()=>{'use strict';
const root=document.documentElement,home=new URL('./',document.currentScript.src).href;
root.dataset.memberLocked='true';const style=document.createElement('style');style.textContent='html[data-member-locked="true"] body>*:not(#ikigaiMemberGate){visibility:hidden!important;pointer-events:none!important}#ikigaiMemberGate{position:fixed;inset:0;z-index:2147483647;display:grid;place-content:center;padding:24px;background:#143b46;color:#fff;font:16px system-ui;text-align:center;gap:14px}#ikigaiMemberGate a{display:inline-block;background:#d2eae2;color:#153d48;border-radius:9px;padding:12px;text-decoration:none}';document.head.append(style);
function block(text){const show=()=>{const gate=document.createElement('section');gate.id='ikigaiMemberGate';gate.setAttribute('role','alert');const p=document.createElement('p');p.textContent=text;const link=document.createElement('a');link.href=home;link.target='_top';link.textContent='Đăng nhập IKIGAI';gate.append(p,link);document.body.append(gate)};if(document.body)show();else document.addEventListener('DOMContentLoaded',show,{once:true})}
async function verify(){
 try{for(const win of [window.parent,window.opener])if(win&&win!==window&&win.location.origin===location.origin&&win.IKIGAI_MEMBER_ACCESS?.isApproved()){delete root.dataset.memberLocked;return}}
 catch{}
 let session;for(const storage of [sessionStorage,localStorage])try{const raw=storage.getItem('sb-vfimwlijbxamudirejiq-auth-token');if(raw){const candidate=JSON.parse(raw);if(candidate?.access_token){session=candidate;break}}}catch{}
 if(!session?.access_token){block('Đăng nhập bằng tài khoản đã được giáo viên phê duyệt để vào học.');return}
 try{const response=await fetch('https://vfimwlijbxamudirejiq.supabase.co/rest/v1/rpc/ikigai_account_status',{method:'POST',headers:{apikey:'sb_publishable_IETjbMWeJthqXscH9fkrXg_x2QZiL8D',Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw Error('Cần đăng nhập lại tài khoản IKIGAI.');const data=await response.json();if(!data.allowed){block(data.status==='rejected'?'Yêu cầu đăng ký chưa được chấp nhận. Vui lòng liên hệ giáo viên.':'Tài khoản đang chờ giáo viên phê duyệt.');return}delete root.dataset.memberLocked;}
 catch(e){block(e.message||'Chưa xác minh được quyền truy cập. Vui lòng đăng nhập lại.');}
}
verify();
})();
