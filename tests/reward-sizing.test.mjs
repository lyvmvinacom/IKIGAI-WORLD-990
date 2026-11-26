import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const window={};
const context=vm.createContext({window,document:{documentElement:{},addEventListener(){}},
 MutationObserver:class{observe(){}},ResizeObserver:class{observe(){}},addEventListener(){},requestAnimationFrame(){}});
vm.runInContext(fs.readFileSync(new URL('../shop/reward-sizing.js',import.meta.url),'utf8'),context);
const geometry=window.IKIGAI_REWARD_SIZING.geometry;
test('event sprites retain normal frame dimensions and share the existing foot baseline',()=>{
 const pets={PET011:{solid:1066/1254,foot:1137/1254},PET012:{solid:1111/1254,foot:1179/1254},PET013:{solid:1086/1254,foot:1163/1254}};
 for(const [w,h]of [[36,40],[55,150],[100,180],[210,210],[180,240],[400,280],[32,52]]){
  for(const position of ['50% 50%','50% 100%','100% 100%']){
   const align=position.endsWith('100%')?1:.5,S=Math.min(w,h);
   for(const [id,m]of Object.entries(pets)){
    const g=geometry(id,w,h,position),draw=w-2*g.padding,delta=Number(g.position.match(/\+ ([\d.-]+)px/)[1]);
    assert(g.padding>=0);assert(Math.abs(draw-g.drawHeight)<1e-8);
    assert(Math.abs(draw*m.solid/S-.752)<1e-8);
    const foot=(h-draw)*align+draw*m.foot+delta;
    assert(Math.abs(foot-((h-S)*align+S*1202/1254))<.001);
   }
   const g=geometry('VIP025',w,h,position),draw=(w-2*g.padding)/(1024/1536);
   const delta=Number(g.position.match(/\+ ([\d.-]+)px/)[1]);
   assert(Math.abs(draw-S)<1e-8);
   assert(Math.abs((h-draw)*align+draw*1455/1536+delta-((h-S)*align+S*1197/1254))<.001);
   assert(Math.abs(draw*(1391/1536)/S-1145/1254)<.01);
  }
 }
});
test('no sizing is applied to other items or hidden images',()=>{
 assert.equal(geometry('VIP001',100,150),null);assert.equal(geometry('PET011',0,0),null);
});
