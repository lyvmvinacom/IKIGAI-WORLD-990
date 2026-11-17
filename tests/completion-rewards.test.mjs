import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
function harness(kind){
 const nodes=new Map(),events=new Map(),calls=[];let serial=0;
 const makeNode=()=>({style:{},isConnected:true,textContent:'',setAttribute(){},append(){},after(){},remove(){this.isConnected=false;}});
 for(const id of ['bunpouXP','hud','repeat','cover','summary'])nodes.set(id,{...makeNode(),insertBefore(){}});
 const parent={location:{origin:'https://game.test'},IKIGAI_REWARDS:{rpc:async(name,args)=>{calls.push({name,args});return name==='ikigai_start_lesson_reward'?{registered:true}:{coins_awarded:50,coins_total:500};}}};
 parent.IKIGAI_BUNPOU_AWARD=parent.IKIGAI_KOTOBA_AWARD=async args=>{calls.push({name:'answer',args});return {earned:0};};
 const window={parent,opener:null,location:parent.location,addEventListener:(name,fn)=>events.set(name,fn)};
 const doc={createElement:makeNode,getElementById:id=>nodes.get(id)||null};
 const ctx=vm.createContext({window,document:doc,location:parent.location,crypto:{randomUUID:()=>`run-${++serial}`},console,setTimeout:fn=>{fn();},sessionStorage:{getItem:()=>null},localStorage:{getItem:()=>null}});
 vm.runInContext(source('completion-rewards.js'),ctx);if(kind)vm.runInContext(source(kind+'-xp.js'),ctx);
 return {calls,nodes,events,api:window.IKIGAI_REWARD_CLIENT,parent,dispatch:(name,detail)=>events.get(name)?.({detail})};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
for(const kind of ['bunpou','kotoba'])test(kind+': completion follows saved answers and reuses its registered run ID',async()=>{
 const h=harness(kind);h.dispatch(kind+':run',{ids:['q1','q2']});
 h.dispatch(kind+':answer',kind==='bunpou'?{question:'q1',parts:[]}:{word:'q1',mode:'jp',answer:'x'});
 h.dispatch(kind+':complete',{completed:false});await settle();assert(!h.calls.some(c=>c.name==='ikigai_completion_reward'));
 h.dispatch(kind+':complete',{completed:true});await settle();
 const register=h.calls.find(c=>c.name==='ikigai_start_lesson_reward'),claim=h.calls.find(c=>c.name==='ikigai_completion_reward');
 assert(register&&claim);assert.equal(claim.args.p_attempt,register.args.p_attempt);assert.equal(claim.args.p_source,kind);
 assert(h.calls.findIndex(c=>c.name==='answer')<h.calls.findIndex(c=>c.name==='ikigai_completion_reward'));
 h.dispatch(kind+':run',{ids:['q1','q2']});await settle();assert.notEqual(h.calls.filter(c=>c.name==='ikigai_start_lesson_reward')[1].args.p_attempt,register.args.p_attempt);
});
test('network retry keeps the same completion receipt',async()=>{
 const h=harness();let tries=0;const args=[];
 h.parent.IKIGAI_REWARDS.rpc=async(name,p)=>{args.push(p);if(++tries===1)throw Error('temporary network failure');return {coins_awarded:50};};
 const result=await h.api.claim('jft_drill','stable-attempt');assert.equal(result.coins_awarded,50);assert.equal(tries,2);assert.deepEqual(args[0],args[1]);
});
test('result status separates a real receipt from a guest session',async()=>{
 const h=harness(),paid=h.nodes.get('cover'),guest=h.nodes.get('summary');
 h.api.mountStatus(paid,async()=>({coins_awarded:200}));h.api.mountStatus(guest,async()=>({guest:true}));await settle();
 assert.match(paid.textContent,/200 xu/);assert.match(guest.textContent,/khách/);assert(!guest.textContent.includes('200'));
});
