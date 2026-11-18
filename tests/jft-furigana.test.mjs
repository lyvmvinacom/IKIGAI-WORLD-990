import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const moduleText=await readFile(new URL('../jft-a2/furigana.js',import.meta.url),'utf8');
const {renderFurigana,normalizeFields,replaceReading}=await import('data:text/javascript;base64,'+Buffer.from(moduleText).toString('base64'));
const q={prompt:'受付へ行き、受付で聞きます。',options:['申込書','窓口'],instruction:'正しい答えを選びなさい。',underlined:'受付'};
const original=JSON.stringify(q);
test('annotates only the chosen occurrence; source strings and choice values unchanged',()=>{
 const fields=replaceReading({},'prompt',q.prompt,6,8,'うけつけ');
 const html=renderFurigana({...q,furigana:{fields}},'prompt');
 assert.equal(html,'受付へ行き、<ruby>受付<rp>（</rp><rt>うけつけ</rt><rp>）</rp></ruby>で聞きます。');assert.equal(JSON.stringify(q),original);
});
test('can edit and remove readings without changing source',()=>{
 let f=replaceReading({},'options.0',q.options[0],0,3,'もうしこみしょ');
 f=replaceReading(f,'options.0',q.options[0],0,3,'もうしこみ');assert.equal(f['options.0'].spans.length,1);
 f=replaceReading(f,'options.0',q.options[0],0,3,'');assert.deepEqual(f,{});
});
test('source mismatch, overlapping spans and markup cannot produce ruby',()=>{
 for(const fields of [
  {'prompt':{text:'違う',spans:[{start:0,end:1,reading:'あ'}]}},
  {'prompt':{text:q.prompt,spans:[{start:0,end:2,reading:'あ'},{start:1,end:3,reading:'い'}]}},
  {'prompt':{text:q.prompt,spans:[{start:0,end:2,reading:'<script>alert(1)</script>'}]}}
 ])assert.deepEqual(normalizeFields(q,fields),{});
 assert.equal(renderFurigana({prompt:'<img onerror=x>'},'prompt'),'&lt;img onerror=x&gt;');
});
test('code point positions support supplementary Kanji and preserve underline',()=>{
 const q={prompt:'𠮷田さん',options:[],underlined:'𠮷田',furigana:{fields:{prompt:{text:'𠮷田さん',spans:[{start:0,end:2,reading:'よしだ'}]}}}};
 assert.equal(renderFurigana(q,'prompt',q.underlined),'<ruby><u>𠮷田</u><rp>（</rp><rt>よしだ</rt><rp>）</rp></ruby>さん');
});
test('display and audio overlays keep the original server scoring proof',async()=>{
 const raw=JSON.stringify({format:'ikigai-jft-1',source:'test',tests:[{id:'sore-vol2-11',questions:[{...q,listen:{mp3:'old'}}]}]});
 const fields=replaceReading({},'options.0',q.options[0],0,3,'もうしこみしょ');
 const account={canLoad:true,loadExam:async()=>raw,loadAudio:async()=>[],loadFurigana:async()=>[{number:1,fields,revision:1}]};
 const window={IKIGAI_JFT_ACCOUNT:account,addEventListener(){}};
 const context={window,location:{hash:''},sessionStorage:{getItem(){return null}},crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array};
 vm.runInNewContext(await readFile(new URL('../jft-a2/class-link.js',import.meta.url),'utf8'),context);
 const loaded=await window.IKIGAI_JFT_CLASS_LINK.load('sore-vol2-11');
 assert.equal(loaded.tests[0].questions[0].furigana.revision,1);
 assert.equal(loaded.tests[0].questions[0].options[0],'申込書');
 const expected=Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode('ikigai-world-jft:score-proof:v2:'+raw))).toString('hex');
 assert.equal(window.IKIGAI_JFT_CLASS_LINK.scoreProof('sore-vol2-11'),expected);
});
test('native text loads before ruby, keeps cropped choices and original scoring proof',async()=>{
 const original={...q,section:0,prompt:'',passage:'',figure:'data:image/png;base64,AAAA',correct:1};
 const raw=JSON.stringify({tests:[{id:'sore-vol2-11',questions:[original]}]});
 const fields=replaceReading({},'prompt','受付へ行ってください。',0,2,'うけつけ');
 const account={canLoad:true,loadExam:async()=>raw,
  loadText:async()=>[{number:1,fields:{prompt:'受付へ行ってください。',figure:'data:image/png;base64,BBBB'}}],
  loadFurigana:async()=>[{number:1,fields,revision:1}]};
 const window={IKIGAI_JFT_ACCOUNT:account,addEventListener(){}};
 vm.runInNewContext(await readFile(new URL('../jft-a2/class-link.js',import.meta.url),'utf8'),
  {window,location:{hash:''},sessionStorage:{getItem(){return null}},crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array});
 const loaded=(await window.IKIGAI_JFT_CLASS_LINK.load('sore-vol2-11')).tests[0].questions[0];
 assert.equal(loaded.prompt,'受付へ行ってください。');
 assert.equal(loaded.figure,'data:image/png;base64,BBBB');
 assert.match(renderFurigana(loaded,'prompt'),/<ruby>受付/);
 assert.deepEqual(Array.from(loaded.options),q.options);assert.equal(loaded.correct,1);
 const proof=Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode('ikigai-world-jft:score-proof:v2:'+raw))).toString('hex');
 assert.equal(window.IKIGAI_JFT_CLASS_LINK.scoreProof('sore-vol2-11'),proof);
 account.loadText=async()=>[{number:1,fields:{passage:'お知らせ',figure:null}}];
 assert.equal((await window.IKIGAI_JFT_CLASS_LINK.load('sore-vol2-11')).tests[0].questions[0].figure,null);
 for(const updates of [
  [{number:1,fields:{prompt:'a',correct:0}}],
  [{number:1,fields:{prompt:'a',options:['x']}}],
  [{number:1,fields:{prompt:'a',figure:'https://example.test/x.png'}}],
  [{number:2,fields:{prompt:'a'}}],
  [{number:1,fields:{prompt:'a'}},{number:1,fields:{prompt:'b'}}]
 ]){account.loadText=async()=>updates;await assert.rejects(window.IKIGAI_JFT_CLASS_LINK.load('sore-vol2-11'),/Bản chữ/);}
});
