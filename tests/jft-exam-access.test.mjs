import test from 'node:test';import assert from 'node:assert/strict';import {readFile}from'node:fs/promises';
const {entryClosed,mergeCatalog}=await import('data:text/javascript;base64,'+Buffer.from(await readFile(new URL('../jft-a2/exam-access.js',import.meta.url))).toString('base64'));
test('only controlled closed exams block student entry; teachers can preview',()=>{
 assert.equal(entryClosed({id:'old-exam'}),false);
 assert.equal(entryClosed({access:{controlled:false,open:false}}),false);
 assert.equal(entryClosed({access:{controlled:true,open:false}}),true);
 assert.equal(entryClosed({access:{controlled:true}}),true);
 assert.equal(entryClosed({access:{controlled:true,open:true}}),false);
 assert.equal(entryClosed({access:{controlled:true,open:false}},true),false);
});
test('catalog refresh updates the same card for opening and closing without duplicate IDs',()=>{
 const tests=[{id:'old-exam'},{id:'new-exam',access:{controlled:true,open:false,revision:1}}];const card=tests[1];
 assert.equal(mergeCatalog(tests,[{id:'new-exam',access:{controlled:true,open:true,revision:2}}]),true);
 assert.equal(tests[1],card);assert.equal(entryClosed(card),false);assert.equal(tests.length,2);
 assert.equal(mergeCatalog(tests,[{id:'new-exam',access:{controlled:true,open:true,revision:2}}]),false);
 mergeCatalog(tests,[{id:'new-exam',access:{controlled:true,open:false,revision:3}}]);assert.equal(entryClosed(card),true);
 assert.equal(tests[0].access,undefined);assert.throws(()=>mergeCatalog(tests,null));
});


test('renamed titles and descriptions refresh existing cards without changing entry controls',()=>{
 const access={controlled:true,open:false,revision:7};
 const card={id:'exam',title:'Đề 13',source:'Mô tả cũ',metadataRevision:0,access};
 const current=[card];
 assert.equal(mergeCatalog(current,[{id:'exam',title:'Đề luyện A2',source:'',metadataRevision:1}]),true);
 assert.equal(current[0],card);assert.equal(card.source,'');assert.equal(card.title,'Đề luyện A2');assert.equal(card.access,access);assert.equal(entryClosed(card),true);
 assert.equal(mergeCatalog(current,[{id:'exam',title:'Đề luyện A2',source:'',metadataRevision:1}]),false);
 assert.equal(mergeCatalog(current,[{id:'exam',title:'Đề luyện A2',source:'Thông tin mới',metadataRevision:2}]),true);
 assert.equal(card.source,'Thông tin mới');assert.equal(card.access.revision,7);
});
