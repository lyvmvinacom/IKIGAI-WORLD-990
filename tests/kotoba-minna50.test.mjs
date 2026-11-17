import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const html=fs.readFileSync(new URL('../kotoba-ninja.html',import.meta.url),'utf8');
const bank=JSON.parse(html.match(/let BANK=(\[.*?\]);/s)[1]);
const counts=[46,47,48,45,52,40,55,52,51,44,45,47,44,44,62,53,51,29,41,34,30,27,32,40,31];
test('reviewed lessons 26–50 append 1090 entries and preserve every N5 word',()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(bank.filter(q=>q.lesson<=25))).digest('hex'),'58b8226f46f5cce5f32696654229437ad1db55e6c1c7a96ef10c4fabeefacbb6');
 assert.equal(bank.length,2102);assert.equal(new Set(bank.map(q=>q.id)).size,bank.length);
 counts.forEach((n,i)=>assert.equal(bank.filter(q=>q.lesson===26+i).length,n));
 for(const q of bank){assert(q.jp.trim());assert(q.vi.trim());}
 assert(!bank.some(q=>q.id==='WORD-L26-043'));
 assert(html.includes('i<=50;i++'));assert(html.includes('2102 mục từ chơi được'));
 for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
});
test('every new word has four distinct answers in all three existing modes',()=>{
 // Extract the existing game functions, keeping the same production option rules.
 const shuffleSource=html.slice(html.indexOf('const shuffle='),html.indexOf('for(let i=1;i<=50;i++)'));
 const choicesSource=html.slice(html.indexOf('function choices(q)'),html.indexOf('function showJapanese('));
 const ctx=vm.createContext({BANK:bank,jftContext:null,all:[],mode:'jp'});
 vm.runInContext(shuffleSource+'\n'+choicesSource,ctx);
 for(let lesson=26;lesson<=50;lesson++){
  ctx.all=bank.filter(q=>q.lesson===lesson);
  for(const mode of ['jp','vi','listen']){
   ctx.mode=mode;
   for(const q of ctx.all){const opts=ctx.choices(q);assert.equal(opts.length,4);assert.equal(new Set(opts).size,4);assert(opts.includes(q[mode==='vi'?'jp':'vi']));}
  }
 }
});
