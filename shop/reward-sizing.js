/* Render event art inside the same square sprite frame as the existing skins.
   Padding changes the painted image, never the actor's layout box or animation. */
(()=>{'use strict';
 const metrics={
  VIP025:{aspect:1024/1536,scale:1,foot:1455/1536,targetFoot:1197/1254},
  PET011:{aspect:1,scale:.752/(1066/1254),foot:1137/1254,targetFoot:1202/1254},
  PET012:{aspect:1,scale:.752/(1111/1254),foot:1179/1254,targetFoot:1202/1254},
  PET013:{aspect:1,scale:.752/(1086/1254),foot:1163/1254,targetFoot:1202/1254}
 };
 const keys=['box-sizing','padding-left','padding-right','padding-top','padding-bottom','object-fit','object-position'];
 const saved=new WeakMap(),tracked=new Set();let queued=false;
 function geometry(id,width,height,position='50% 50%'){
  const m=metrics[id];if(!m||width<=0||height<=0)return null;
  const parts=position.trim().split(/\s+/),y=parts[1]||'50%';
  const align=y==='bottom'?1:y==='top'?0:y==='center'?.5:Number.isFinite(parseFloat(y))?parseFloat(y)/100:.5;
  const side=Math.min(width,height),drawHeight=side*m.scale;
  const offset=side*(align*(m.scale-1)+m.targetFoot-m.foot*m.scale);
  return {padding:(width-drawHeight*m.aspect)/2,position:(parts[0]||'50%')+' calc('+(align*100)+'% + '+offset.toFixed(4)+'px)',
   side,drawHeight,visibleFoot:(height-side)*align+side*m.targetFoot};
 }
 function update(img){
  const id=img.getAttribute('src')?.match(/(?:\/|^)(VIP025|PET011|PET012|PET013)\.png(?:[?#]|$)/)?.[1];
  if(!id){const prev=saved.get(img);if(prev){for(const key of keys){const [value,priority]=prev.styles[key];value?img.style.setProperty(key,value,priority):img.style.removeProperty(key)}saved.delete(img);delete img.dataset.rewardSized}return;}
  if(!saved.has(img)){saved.set(img,{position:getComputedStyle(img).objectPosition,styles:Object.fromEntries(keys.map(k=>[k,[img.style.getPropertyValue(k),img.style.getPropertyPriority(k)]]))});}
  const g=geometry(id,img.clientWidth,img.clientHeight,saved.get(img).position);if(!g)return;
  const values={'box-sizing':'border-box','padding-left':g.padding.toFixed(4)+'px','padding-right':g.padding.toFixed(4)+'px',
   'padding-top':'0px','padding-bottom':'0px','object-fit':'contain','object-position':g.position};
  for(const [key,value]of Object.entries(values))if(img.style.getPropertyValue(key)!==value||img.style.getPropertyPriority(key)!=='important')img.style.setProperty(key,value,'important');
  img.dataset.rewardSized=id;
 }
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(entries=>entries.forEach(e=>update(e.target))):null;
 function scan(){queued=false;
  for(const img of tracked)if(!img.isConnected){observer?.unobserve(img);tracked.delete(img)}
  for(const img of document.querySelectorAll('img')){
   if(!saved.has(img)&&!/(?:VIP025|PET01[123])\.png(?:[?#]|$)/.test(img.getAttribute('src')||''))continue;
   if(!tracked.has(img)){tracked.add(img);try{observer?.observe(img,{box:'border-box'})}catch{observer?.observe(img)}}update(img);
  }
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(scan)}}
 new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
 addEventListener('resize',schedule);addEventListener('load',schedule);document.addEventListener('load',schedule,true);
 window.IKIGAI_REWARD_SIZING={geometry,scan:schedule};schedule();
})();
