(() => {
 'use strict';
 const $=id=>document.getElementById(id), fmt=n=>Number(n||0).toLocaleString('vi-VN');
 const names=['Chiến Binh','Băng Giá','Trí Tuệ','Ánh Dương','Hỏa Lực','Dễ Thương','Thanh Lịch','Năng Động','Du Học Sinh','Cá Tính'];
 let api=null,catalog=[],owned=new Set(),equipment={character:null,pet:null},base=null,coins=0,ready=false,busy=false,canTrade=false,pending=null;
 let view=new URLSearchParams(location.search).get('view')==='character'?'character':'shop',kind='character',selected=null;
 try{if(parent!==window&&parent.location.origin===location.origin)api=parent.IKIGAI_SHOP;}catch{}
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const message=e=>api?.message?.(e)||'Hãy mở Shop từ game và đăng nhập bằng tài khoản học viên.';
 function all(){return base?[base,...catalog]:catalog;}
 function imageSource(x){if(!x)return '';if(/^FREE[0-9]$/.test(x.id)){const i=Number(x.id.slice(4));return '../assets/characters/gunny_'+(i<5?'m':'f')+'_'+i%5+'.png';}return /^(VIP|PET)\d{3}$/.test(x.id)?'sprites/'+x.id+'.png?v=20261116-hd-1':'';}
 function art(x,cls='shop-sprite'){return x?'<img class="'+cls+'" src="'+imageSource(x)+'" alt="'+esc(x.name)+'" loading="lazy">':'';}
 function list(){return (view==='shop'?catalog.filter(x=>!x.event_only):all().filter(x=>owned.has(x.id))).filter(x=>x.kind===kind).sort((a,b)=>b.price-a.price||a.id.localeCompare(b.id));}
 function equippedId(k){return equipment[k]||(k==='character'?base?.id:null);}
 function render(){
  const pos=$('items').scrollTop,l=list();if(!l.some(x=>x.id===selected?.id))selected=l.find(x=>x.id===equippedId(kind))||l[0]||null;
  $('wallet').textContent=ready?'🪙 '+fmt(coins)+' xu':canTrade?'Đang đồng bộ…':'Đăng nhập để dùng xu';
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',String(b.dataset.view===view));b.disabled=busy;});
  document.querySelectorAll('[data-kind]').forEach(b=>{b.classList.toggle('active',b.dataset.kind===kind);b.setAttribute('aria-pressed',String(b.dataset.kind===kind));b.disabled=busy;});
  $('items').replaceChildren();
  for(const x of l){const b=document.createElement('button');b.type='button';b.dataset.itemId=x.id;b.className='item '+x.rarity+(x.id===selected?.id?' selected':'');b.setAttribute('aria-pressed',String(x.id===selected?.id));b.disabled=busy;b.innerHTML='<span class="rarity">'+esc(x.rarity)+'</span><div class="art">'+art(x)+'</div><b>'+esc(x.name)+'</b><small>'+esc(x.rarity)+' · '+(owned.has(x.id)?(x.event_only?'Độc quyền Event':'Đã sở hữu'):fmt(x.price)+' xu')+'</small>';b.onclick=()=>{selected=x;render();};$('items').append(b);}
  if(!l.length)$('items').textContent=ready?'Chưa có vật phẩm. Ghé Shop để chọn nhé!':canTrade?'Đang tải kho đồ…':'Đăng nhập để xem kho đồ của bạn.';
  $('items').scrollTop=pos;
  const shown=view==='character'&&kind==='pet'?all().find(x=>x.id===equippedId('character')):selected;
  const companion=view==='character'?(kind==='pet'?selected:all().find(x=>x.id===equipment.pet)):null;
  $('preview').innerHTML=art(shown)+art(companion,'companion');
  $('name').textContent=selected?.name||'Nhân vật & Túi đồ';
  $('detail').textContent=selected?(owned.has(selected.id)?(selected.event_only?'Độc quyền Event · Đã sở hữu':'Đã sở hữu'):fmt(selected.price)+' xu')+' · '+selected.rarity:'';
  $('equipped').textContent=ready?'Đang dùng: '+(all().find(x=>x.id===equippedId('character'))?.name||'Nhân vật ban đầu')+' / '+(all().find(x=>x.id===equipment.pet)?.name||'Không có thú cưng'):'';
  const a=$('action'),isOwned=selected&&owned.has(selected.id),isEquipped=selected?.id===equippedId(kind);
  a.disabled=busy||!ready||!canTrade||!selected||(!isOwned&&coins<selected.price)||(isOwned&&isEquipped&&kind==='character');
  a.textContent=busy?'Đang xử lý…':!canTrade?'Cần đăng nhập':!ready?'Chưa đồng bộ':!selected?'Chưa có':!isOwned?(coins<selected.price?'Không đủ xu':'Mua ngay'):isEquipped?(kind==='pet'?'Tháo thú cưng':'Đang sử dụng'):'Trang bị';
  $('removePet').disabled=busy||!ready||!canTrade||!equipment.pet;
  $('switchView').disabled=busy;$('switchView').textContent=view==='shop'?'Về Túi':'Sang Shop';$('reloadShop').disabled=busy;
 }
 function accept(s){
  if(!Number.isSafeInteger(s?.coins)||s.coins<0||!Array.isArray(s.catalog)||!Array.isArray(s.inventory))throw new Error('INVALID_STATE');
  const p=s.profile||{},index=(p.gender==='female'?5:0)+Math.max(0,Math.min(4,Number(p.avatar)||0));
  base={id:'FREE'+index,kind:'character',name:names[index],price:0,rarity:'FREE'};
  catalog=[...s.catalog,...(s.reward_catalog||[])];owned=new Set([base.id,...s.inventory.map(x=>x.item_id)]);equipment={character:null,pet:null};for(const x of s.equipment||[])equipment[x.kind]=x.item_id;
  coins=s.coins;ready=true;canTrade=s.enabled&&p.role==='student';$('profile').textContent=(p.nickname||'IKIGAI EDUCATION')+' · TỦ ĐỒ CÁ NHÂN';render();
 }
 async function sync(){
  if(busy)return;busy=true;render();
  try{if(!api?.context?.().available)throw new Error('AUTH_REQUIRED');accept(await api.getState());$('feedback').textContent='Xu và kho đồ đã đồng bộ với tài khoản. Trang bị sẽ hiển thị trong các phòng.';}
  catch(e){ready=false;$('feedback').textContent=message(e);}
  finally{busy=false;render();}
 }
 async function transact(action,success){
  if(busy||!ready||!canTrade)return;busy=true;render();
  try{accept(await action());$('feedback').textContent=success;}
  catch(e){$('feedback').textContent=message(e);try{accept(await api.getState());}catch{} }
  finally{busy=false;render();}
 }
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;kind='character';selected=null;render();});
 document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{kind=b.dataset.kind;selected=null;render();});
 $('switchView').onclick=()=>{view=view==='shop'?'character':'shop';kind='character';selected=null;render();};
 $('reloadShop').onclick=sync;
 $('action').onclick=()=>{
  if(!selected||busy||!ready||!canTrade)return;
  if(owned.has(selected.id)){const item=selected,remove=item.id===equippedId(kind)&&kind==='pet';const id=item.id.startsWith('FREE')||remove?null:item.id;transact(()=>api.equip(item.kind,id),remove?'Đã tháo thú cưng.':'Đã trang bị '+item.name+'.');return;}
  if(coins<selected.price)return;pending={id:selected.id,name:selected.name,price:selected.price};$('question').textContent='Mua '+pending.name+' với '+fmt(pending.price)+' xu trong tài khoản?';$('confirm').showModal();
 };
 $('removePet').onclick=()=>transact(()=>api.equip('pet',null),'Đã tháo thú cưng.');
 $('no').onclick=()=>{pending=null;$('confirm').close();};$('confirm').addEventListener('cancel',()=>{pending=null;});
 $('yes').onclick=()=>{const item=pending;pending=null;$('confirm').close();if(item)transact(()=>api.purchase(item.id,item.price),'Đã mua '+item.name+'. Chọn Trang bị để sử dụng.');};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('confirm').open&&parent!==window)parent.postMessage({type:'ikigai-shop-close'},location.origin);});
 function alignPedestal(){const w=innerWidth,h=innerHeight,scale=Math.max(w/1672,h/941),size=Math.min(420,h*.56,document.querySelector('aside').clientWidth*.92),root=document.documentElement.style;root.setProperty('--pedestal-x',((w-1672*scale)/2+418*scale)+'px');root.setProperty('--pedestal-y',((h-941*scale)/2+663*scale)+'px');root.setProperty('--preview-size',size+'px');}
 alignPedestal();addEventListener('resize',alignPedestal);new ResizeObserver(alignPedestal).observe(document.querySelector('aside'));
 async function boot(){
  canTrade=!!api?.context?.().available;render();
  try{const response=await fetch('catalog.json?v=live-1');if(!response.ok)throw new Error('CATALOG_LOAD');catalog=await response.json();render();}catch(e){$('feedback').textContent='Chưa tải được danh sách vật phẩm. Hãy tải lại Shop.';}
  await sync();
 }
 boot();
})();
