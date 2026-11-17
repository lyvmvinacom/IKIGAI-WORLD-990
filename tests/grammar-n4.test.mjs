import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const root=new URL('../',import.meta.url);
const old=JSON.parse(fs.readFileSync(new URL('grammar-tests.json',root),'utf8'));
const added=JSON.parse(fs.readFileSync(new URL('grammar-tests-n4.json',root),'utf8'));
const base='source-2026-11-11-source644-reviewed197';
function harness(){
 const state={user:null,client:null,role:'guest'},saved=[],fetches=[];
 const nodes=new Map();
 const node=()=>({onclick:null,textContent:'',disabled:false,classList:{add(){},remove(){},toggle(){}},addEventListener(){},remove(){}});
 const host={...node(),innerHTML:'',hidden:false,querySelector(s){if(s==='#grammar-retry'||s==='#grammar-manage')return null;if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},querySelectorAll(){return [];}};
 const window={IKIGAI_GRAMMAR_CONTEXT:()=>state,IKIGAI_REWARD_CLIENT:{mountStatus(){},claim(){}}};
 const context={window,document:{getElementById:()=>host,addEventListener(){}},crypto:webcrypto,TextEncoder,structuredClone,Date,console,setInterval:()=>1,clearInterval(){},fetch:async path=>{fetches.push(path);return {ok:true,json:async()=>structuredClone(path.startsWith('grammar-tests-n4')?added:old)}}};
 const code=fs.readFileSync(new URL('grammar-tests.js',root),'utf8').replace(/\}\)\(\);\s*$/,`globalThis.__grammar={validate,init,begin,finish,bankVersion,menu,loadRemote,\ngetState:()=>({tests,questions,answers,contentVersion,attemptVersion}),\nsetup:(t,as)=>{current=t;questions=structuredClone(t.questions);answers=as;started=Date.now();attemptVersion=bankVersion(t);remoteReady=true;busy=false;pending=null;}};})();`);
 vm.runInNewContext(code,context);
 function student(){
  state.user={id:'11111111-1111-4111-8111-111111111111',app_metadata:{role:'student'}};state.role='student';
  state.client={from(table){return {insert:async p=>{assert.equal(table,'ikigai_grammar_results');saved.push(structuredClone(p));return {error:null}},select(){return this},eq(){return this},in(){return this},order(){return this},limit:async()=>({data:[],error:null}),range:async()=>({data:[],error:null})}}};
 }
 return {api:context.__grammar,host,state,saved,fetches,student};
}
test('24 tests load together and the original 12 tests are preserved',async()=>{
 const h=harness();await h.api.init();assert.equal(h.fetches.length,2);const s=h.api.getState();assert.equal(s.tests.length,24);assert.equal(JSON.stringify(s.tests.slice(0,12)),JSON.stringify(old));assert.equal(s.contentVersion,base);assert.match(h.host.innerHTML,/Bài 48–49/);assert.match(h.host.innerHTML,/Bài 1–2/);
 assert.equal(h.api.bankVersion(s.tests[0]),base);assert.equal(h.api.bankVersion(s.tests[12]),'source-2026-11-17-n4-approved659');
 const invalid=structuredClone(s.tests);invalid[23].id=invalid[0].id;assert.throws(()=>h.api.validate(invalid),/Đề không hợp lệ/);
});
test('approved bank has 659 questions with all four options and exact rich-text content',()=>{
 assert.equal(added.length,12);assert.equal(added.reduce((n,t)=>n+t.questions.length,0),659);
 const ids=new Set,txt=p=>p.map(x=>typeof x==='string'?x:x.text).join('');
 for(const t of added)for(const q of t.questions){assert(!ids.has(q.id));ids.add(q.id);assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.match(q.correct,/^[ABCD]$/);assert.equal(txt(q.question_parts),q.question);q.options.forEach((v,i)=>assert.equal(txt(q.option_parts[i]),v));if(q.passage_id)assert(t.passages[q.passage_id]);if(q.image)assert(fs.existsSync(new URL(q.image,root)));}
});
test('30–31 excludes all 40 removed questions and renumbers its 55 retained questions',()=>{
 const t=added.find(t=>t.id==='grammar-15');assert.equal(t.questions.length,55);assert.equal(t.scoring.denominator,55);assert.equal(t.questions[40].id,'G30_31_081');assert.deepEqual(t.questions.map(q=>q.number),Array.from({length:55},(_,i)=>i+1));assert(!t.questions.some(q=>q.original_number>=41&&q.original_number<=80));assert.deepEqual(t.sections.map(s=>s.number),[1,2,3,4,5,6]);
});
test('actual submission uses 55 as denominator and saves the N4 test and bank version',async()=>{
 for(const [count,score] of [[0,0],[1,2],[27,49],[28,51],[54,98],[55,100]]){
  const h=harness();h.student();const t=added.find(t=>t.id==='grammar-15');const answers=t.questions.map((q,i)=>i<count?q.correct:'ABCD'[(('ABCD'.indexOf(q.correct))+1)%4]);h.api.setup(t,answers);await h.api.finish();assert.equal(h.saved.length,1);const p=h.saved[0];assert.equal(p.test_id,'grammar-15');assert.equal(p.total_count,55);assert.equal(p.correct_count,count);assert.equal(p.score_percent,score);assert.equal(p.answers.length,55);assert.equal(p.question_ids.length,55);assert.equal(p.bank_version,'source-2026-11-17-n4-approved659');assert.match(h.host.innerHTML,new RegExp(score+'/100'));await h.api.finish();assert.equal(h.saved.length,1);
 }
});
