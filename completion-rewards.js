/* Same-origin reward bridge; wallets and completion receipts remain server-owned. */
(()=>{'use strict';
 const endpoint='https://vfimwlijbxamudirejiq.supabase.co/rest/v1/rpc/';
 const key='sb_publishable_IETjbMWeJthqXscH9fkrXg_x2QZiL8D';
 function session(){for(const store of [sessionStorage,localStorage])try{const s=JSON.parse(store.getItem('sb-vfimwlijbxamudirejiq-auth-token')||'null');if(s?.access_token)return s;}catch{}return null;}
 function bridge(){for(const w of [window.parent,window.opener,window])try{if(w&&w.location.origin===location.origin&&w.IKIGAI_REWARDS?.rpc)return w.IKIGAI_REWARDS;}catch{}return null;}
 async function rpc(name,args){
  const b=bridge();if(b)return b.rpc(name,args);
  const s=session();if(!s||s.user?.is_anonymous||s.user?.app_metadata?.role==='teacher')return {guest:true};
  const response=await fetch(endpoint+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify(args)});
  const data=await response.json();if(!response.ok)throw Error(data.message||'Chưa đồng bộ thưởng xu');return data;
 }
 async function retry(fn){let error;for(let n=0;n<3;n++)try{return await fn();}catch(e){error=e;if(n<2)await new Promise(r=>setTimeout(r,350*(n+1)));}throw error;}
 const api={
  rpc:(name,args)=>retry(()=>rpc(name,args)),
  start:(source,attempt,ids)=>retry(()=>rpc('ikigai_start_lesson_reward',{p_source:source,p_attempt:attempt,p_ids:ids})),
  claim:(source,attempt)=>retry(()=>rpc('ikigai_completion_reward',{p_source:source,p_attempt:attempt})),
  verbs:(attempt,answers)=>retry(()=>rpc('ikigai_finish_verb_reward',{p_attempt:attempt,p_answers:answers})),
  mountStatus(node,operation){
   if(!node)return;node.setAttribute('role','status');node.style.cssText='font-size:12px;line-height:1.5;color:#e6c983;margin:8px 0';
   const run=async()=>{node.textContent='Đang xác nhận thưởng xu…';try{const r=await operation();if(!node.isConnected)return;
    node.textContent=r?.guest?'Tài khoản khách / giáo viên không nhận xu.':r?.coins_awarded?'🪙 Thưởng '+r.coins_awarded+' xu · Đã ghi nhận vào tài khoản.':'Lượt này không có thưởng xu mới.';
   }catch(e){if(!node.isConnected)return;node.textContent='Chưa xác nhận thưởng xu: '+e.message+' ';const button=document.createElement('button');button.type='button';button.textContent='Thử đồng bộ lại';button.style.cssText='padding:4px 9px;font-size:11px;cursor:pointer';button.onclick=run;node.append(button);}};void run();
  }
 };window.IKIGAI_REWARD_CLIENT=api;
})();
