import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../verb-practice/app.js',import.meta.url),'utf8');
const context=vm.createContext({});vm.runInContext(source.slice(0,source.indexOf('const FORMS='))+';globalThis.data={BANK,AUDIO_BANK,conjugate,matches,makeChoices,normalize};',context);
const {BANK,AUDIO_BANK,conjugate,matches,makeChoices,normalize}=context.data;
const chunks=new Map();
const suffixes={dictionary:/[うくぐすつぬぶむる]$/,te:/[てで]$/,ta:/[ただ]$/,nai:/ない$/,potential:/る$/,volitional:/う$/,imperative:/[えけげせてねべめれろよい]$/,prohibition:/な$/,conditional:/ば$/,passive:/れる$/,causative:/せる$/,causativePassive:/れる$/};
test('all playable conjugations have 3 unique same-form choices and exactly one correct answer',()=>{
 assert.equal(BANK.filter(v=>v.level==='N5').length,114);assert.equal(BANK.filter(v=>v.level==='N4').length,161);
 for(const v of BANK)for(const [form,suffix] of Object.entries(suffixes)){
  if(v.basicOnly&&!['dictionary','te','nai','ta','conditional'].includes(form)||v.allowedForms&&!v.allowedForms.includes(form))continue;
  for(let n=0;n<8;n++){const choices=makeChoices(v,form);assert.equal(choices.length,3);assert.equal(new Set(choices.map(c=>normalize(c.reading))).size,3);assert.equal(choices.filter(c=>matches(v,form,c.reading)).length,1);for(const c of choices)assert(suffix.test(c.reading),v.dictionary+' '+form+' '+c.reading);}
  const path=AUDIO_BANK[conjugate(v,form)[0].reading];assert(path);if(!chunks.has(path))chunks.set(path,JSON.parse(fs.readFileSync(new URL('../verb-practice/'+path,import.meta.url),'utf8')));assert(chunks.get(path)[conjugate(v,form)[0].reading]?.length>100);
 }
});
test('known irregular conjugations remain correct',()=>{
 for(const [word,form,answer] of [['行く','te','いって'],['ある','nai','ない'],['する','potential','できる'],['来る','nai','こない'],['くれる','imperative','くれ']]){const v=BANK.find(v=>v.dictionary===word)||{dictionary:word,reading:word==='来る'?'くる':word,group:word==='する'||word==='来る'?3:word==='くれる'?2:1};assert(matches(v,form,answer));}
});
test('group identification is absent in the question and revealed after choice',()=>{
 const question=source.slice(source.indexOf('function renderQuestion'),source.indexOf('function selectAnswer'));
 assert(!question.includes('NHÓM'));assert(!question.includes('v.group-1'));assert(question.includes("$('rules').classList.add('hidden')"));
 const answer=source.slice(source.indexOf('function selectAnswer'),source.indexOf('function next'));
 assert(answer.includes('<details class="explain" open>'));assert(answer.includes('Nhóm '));
});
