/* Shared, server-verified cosmetics and real-wallet shop bridge. */
(() => {
 'use strict';
 const cache=new Map(), pending=new Set(), queried=new Map();
 let hooks=null, client=null, self=null, state=null, channel=null, observer=null, timer=null, paintTimer=null, busy=false;
 const isUUID=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
 const sprite=id=>/^(VIP\d{3}|PET\d{3})$/.test(id||'')?`shop/sprites/${id}.png?v=20261116-hd-1`:null;
 const context=()=>hooks?.context?.()||{};
 function permitted(){const c=context();return !!(c.user&&!c.user.is_anonymous&&c.role==='student'&&c.profileLoaded);}
 function errorMessage(error){const code=String(error?.message||error);const messages={AUTH_REQUIRED:'Hãy đăng nhập bằng tài khoản học viên để dùng Shop.',STUDENT_REQUIRED:'Chỉ tài khoản học viên được mua và trang bị.',PROFILE_REQUIRED:'Hồ sơ chưa đồng bộ. Hãy đăng nhập lại.',SHOP_DISABLED:'Shop đang tạm bảo trì.',ITEM_UNAVAILABLE:'Vật phẩm hiện không được bán.',PRICE_CHANGED:'Giá đã thay đổi. Hãy tải lại Shop trước khi mua.',INSUFFICIENT_COINS:'Bạn chưa đủ xu để mua vật phẩm này.',NOT_OWNED:'Bạn chưa sở hữu vật phẩm này.',INVALID_KIND:'Loại vật phẩm chưa đúng.'};return Object.entries(messages).find(([key])=>code.includes(key))?.[1]||'Chưa kết nối được Shop. Hãy kiểm tra mạng rồi tải lại.';}
 function paint(){
  for(const image of document.querySelectorAll('img[data-cosmetic-user]')){
   const id=image.dataset.cosmeticUser, row=cache.get(id), src=sprite(row?.character_id)||image.dataset.baseSprite;
   if(src&&image.getAttribute('src')!==src)image.setAttribute('src',src);
   ensure([id]);
  }
  for(const actor of document.querySelectorAll('[data-pet-owner]')){
   const id=actor.dataset.petOwner, src=sprite(cache.get(id)?.pet_id);let pet=actor.querySelector(':scope > .ik-equipped-pet');
   if(!src){pet?.remove();}else{if(!pet){pet=document.createElement('img');pet.className='ik-equipped-pet';pet.alt='Thú cưng đồng hành';pet.draggable=false;
    // Keep the cycle's phase when Presence rebuilds a player or changes rooms.
    const clock=Date.now();pet.style.setProperty('--ik-pet-idle-phase',`-${clock%2800}ms`);pet.style.setProperty('--ik-pet-side-phase',`-${clock%22000}ms`);actor.append(pet);
   }if(pet.getAttribute('src')!==src)pet.setAttribute('src',src);}
   ensure([id]);
  }
 }
 function schedule(){clearTimeout(paintTimer);paintTimer=setTimeout(paint,60);}
 async function ensure(ids,force=false){
  const now=Date.now(), wanted=[...new Set(ids)].filter(id=>isUUID(id)&&!pending.has(id)&&(force||!queried.has(id)||now-queried.get(id)>15000));
  if(!client||!wanted.length)return;
  wanted.forEach(id=>pending.add(id));
  try{const {data,error}=await client.from('ikigai_world_cosmetics').select('user_id,character_id,pet_id').in('user_id',wanted.slice(0,200));if(error)throw error;
   for(const id of wanted.slice(0,200)){cache.set(id,null);queried.set(id,now);}for(const row of data||[])cache.set(row.user_id,row);schedule();
  }catch(error){wanted.forEach(id=>queried.set(id,now-10000));}finally{wanted.forEach(id=>pending.delete(id));}
 }
 function accept(next){
  state=next;const equip=Object.fromEntries((next.equipment||[]).map(x=>[x.kind,x.item_id]));
  if(self){cache.set(self,{user_id:self,character_id:equip.character||null,pet_id:equip.pet||null});queried.set(self,Date.now());}
  hooks?.onState?.(next);schedule();return next;
 }
 async function rpc(name,args){if(!permitted())throw new Error('AUTH_REQUIRED');const {data,error}=await client.rpc(name,args);if(error)throw error;return data;}
 async function refresh(){return accept(await rpc('ikigai_shop_state'));}
 async function mutate(name,args){
  if(busy)throw new Error('Một thao tác đang được xử lý.');busy=true;
  try{await rpc(name,args);return await refresh();}finally{busy=false;}
 }
 async function init(options){
  hooks=options;const c=context();if(client&&channel)await client.removeChannel(channel);clearInterval(timer);cache.clear();queried.clear();state=null;
  client=c.client;self=c.user?.id;if(!client)return;
  if(permitted()){try{await refresh();}catch(error){hooks?.onError?.(errorMessage(error));}}
  channel=client.channel('ikigai-cosmetics-'+self).on('postgres_changes',{event:'*',schema:'public',table:'ikigai_world_cosmetics'},event=>{const row=event.new?.user_id?event.new:event.old;if(!row?.user_id)return;cache.set(row.user_id,event.eventType==='DELETE'?null:row);queried.set(row.user_id,Date.now());schedule();if(row.user_id===self&&permitted())refresh().catch(()=>{});}).subscribe();
  if(!observer){observer=new MutationObserver(schedule);observer.observe(document.getElementById('game')||document.body,{childList:true,subtree:true});}
  timer=setInterval(()=>{if(document.hidden)return;ensure([...document.querySelectorAll('[data-cosmetic-user]')].map(x=>x.dataset.cosmeticUser),true);},10000);schedule();
 }
 window.IKIGAI_COSMETICS=Object.freeze({init,spriteFor:id=>sprite(cache.get(id)?.character_id),petFor:id=>sprite(cache.get(id)?.pet_id),ensure,schedule});
 window.IKIGAI_SHOP=Object.freeze({
  context:()=>({available:permitted(),role:context().role||'guest',nickname:context().nickname||''}),
  getState:refresh,
  purchase:(id,price)=>mutate('ikigai_shop_purchase',{p_item:id,p_expected_price:price}),
  equip:(kind,id)=>mutate('ikigai_shop_equip',{p_kind:kind,p_item:id}),
  message:errorMessage
 });
})();
