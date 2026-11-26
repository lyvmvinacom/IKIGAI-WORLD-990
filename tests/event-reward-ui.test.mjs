import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('owned event items appear in inventory, never in the shop, and remain equipable',()=>{
 const nodes=new Map();
 const make=()=>({dataset:{},classList:{toggle(){}},setAttribute(){},style:{},children:[],scrollTop:0,
  replaceChildren(){this.children=[]},append(x){this.children.push(x)},addEventListener(){}});
 const kinds=['character','pet'].map(kind=>Object.assign(make(),{dataset:{kind}}));
 const doc={getElementById:id=>{if(!nodes.has(id))nodes.set(id,make());return nodes.get(id)},
  createElement:make,querySelectorAll:s=>s==='[data-kind]'?kinds:[],
  querySelector:()=>({clientWidth:300}),documentElement:{style:{setProperty(){}}},addEventListener(){}};
 const win={};
 const ctx=vm.createContext({window:win,parent:win,document:doc,location:{search:'',origin:'https://game.test'},
  URLSearchParams,innerWidth:844,innerHeight:390,addEventListener(){},ResizeObserver:class{observe(){}}});
 const code=fs.readFileSync(new URL('../shop/ui.js',import.meta.url),'utf8')
  .replace(' boot();',' window.__rewardTest={accept};');
 vm.runInContext(code,ctx);
 const rewards=[{id:'VIP025',kind:'character',name:'Akatsuki',rarity:'UR'},
  ...['PET011','PET012','PET013'].map(id=>({id,kind:'pet',name:id,rarity:'SR'}))]
  .map(x=>({...x,event_only:true,published:false,price:0}));
 win.__rewardTest.accept({enabled:true,coins:500,profile:{role:'student',gender:'male',avatar:0},
  catalog:[{id:'VIP001',kind:'character',name:'Shop item',rarity:'R',price:3000,published:true}],
  reward_catalog:rewards,inventory:rewards.map(x=>({item_id:x.id})),equipment:[]});
 const items=()=>nodes.get('items').children;
 assert.deepEqual(items().map(x=>x.dataset.itemId),['VIP001']);
 nodes.get('switchView').onclick();
 const akatsuki=items().find(x=>x.dataset.itemId==='VIP025');assert(akatsuki);
 assert.match(akatsuki.innerHTML,/Độc quyền Event/);
 akatsuki.onclick();assert.equal(nodes.get('action').textContent,'Trang bị');
 assert.equal(nodes.get('action').disabled,false);
 kinds[1].onclick();assert.equal(items().length,3);
 for(const id of ['PET011','PET012','PET013'])assert(items().some(x=>x.dataset.itemId===id));
 nodes.get('switchView').onclick();kinds[1].onclick();assert.equal(items().length,0);
});
