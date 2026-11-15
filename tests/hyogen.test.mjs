import test from 'node:test';
import assert from 'node:assert/strict';
import {lessons,practiceSets,allQuestions} from '../jft-drills/hyogen-bank.js';
import {createAttempt,validAttempt,canonicalAnswers,score,segments,isEvidence,ruby,escapeHTML} from '../jft-drills/hyogen-core.js';
test('120 unique authored dialogues; practice is independent from the 30 lesson pairs',()=>{
 assert.equal(lessons.length,30);assert.equal(allQuestions.length,120);
 assert.equal(new Set(allQuestions.map(q=>q.id)).size,120);
 assert.equal(new Set(allQuestions.map(q=>q.prompt)).size,120);
 for(const t of practiceSets){assert.equal(t.questions.length,12);assert.equal(new Set(t.questions.map(q=>q.group)).size,6);}
});
test('every dialogue has a selectable clue, one valid key and complete readings',()=>{
 for(const q of allQuestions){assert.equal(q.accepted.length,1);assert.equal(q.options.length,3);assert.equal(q.uses.length,3);assert.ok(q.prompt.includes('＿＿'));assert.ok(segments(q.prompt).some(s=>isEvidence(q,s.id)),q.id);
  for(const s of [q.prompt,...q.options])assert.ok(!/[\p{Script=Han}]/u.test(ruby(s).replace(/<ruby>[\s\S]*?<\/ruby>/g,'')),q.id);
 }
 assert.equal(escapeHTML('<script>'),'&lt;script&gt;');
});
test('random display order is converted back to the server order',()=>{
 for(const t of practiceSets){const a=createAttempt(t,{},()=>0);assert.ok(validAttempt(a,t));assert.notDeepEqual(a.order,t.questions.map(q=>q.id));for(const q of t.questions)a.answers[q.id]=q.accepted[0];assert.deepEqual(canonicalAnswers(a,t),t.questions.map(q=>q.accepted[0]));assert.deepEqual(score(t,a),{correct:12,total:12});}
});
test('resume rejects stale, duplicate and invalid answer/option snapshots',()=>{
 const t=practiceSets[0],a=createAttempt(t);assert.ok(validAttempt(a,t));assert.equal(validAttempt({...a,version:0},t),false);assert.equal(validAttempt({...a,order:Array(12).fill(a.order[0])},t),false);a.answers[a.order[0]]=9;assert.equal(validAttempt(a,t),false);
});
test('unanswered questions remain wrong and are not silently answered',()=>{
 const t=practiceSets[0],a=createAttempt(t);assert.ok(canonicalAnswers(a,t).every(n=>n===-1));assert.deepEqual(score(t,a),{correct:0,total:12});assert.equal(isEvidence(t.questions[0],'unknown'),false);
});
