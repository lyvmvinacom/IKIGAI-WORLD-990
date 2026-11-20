import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../jft-a2/app.js',import.meta.url),'utf8');
const code=src.slice(src.indexOf('  function jump(index)'),src.indexOf('  function finish(expired)'));
const fixture=new Function('mode',code+`
let active={test:{questions:[0,0,1,2,3,3].map(section=>({section}))},record:{mode,section:0,index:0,answers:[0,null,null,null,null,null]}},screen='exam',submissions=0,saves=0,expired=false,dialogAction;
const syncSimulationState=()=>false,remaining=()=>expired?0:60,stopAudio=()=>{},save=()=>saves++,exam=()=>{},top=()=>{},$=()=>({focus(){},scrollIntoView(){}}),answered=()=>1,confirmAction=(a,b,c,fn)=>{dialogAction=fn},finish=()=>submissions++;
return {jump,requestSubmit,confirm:()=>dialogAction(),state:()=>({...active.record,submissions,saves}),expire:()=>{expired=true}};`);
test('simulation allows same-section navigation and blocks future and past sections',()=>{const f=fixture('simulation');f.jump(1);assert.equal(f.state().index,1);f.jump(2);assert.equal(f.state().index,1);f.requestSubmit();assert.equal(f.state().section,0);f.confirm();assert.equal(f.state().section,1);assert.equal(f.state().index,2);f.jump(0);assert.equal(f.state().index,2);assert.deepEqual(f.state().answers,[0,null,null,null,null,null]);});
test('last section submits only once in normal flow',()=>{const f=fixture('simulation');for(let i=0;i<4;i++){f.requestSubmit();f.confirm();}assert.equal(f.state().submissions,1);});
test('practice retains cross-section navigation',()=>{const f=fixture('practice');f.jump(4);assert.equal(f.state().index,4);f.jump(0);assert.equal(f.state().index,0);});
test('expired attempt submits instead of navigating',()=>{const f=fixture('simulation');f.expire();f.jump(1);assert.equal(f.state().submissions,1);});
