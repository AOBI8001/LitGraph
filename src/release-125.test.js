import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceOpening,groundedEvidenceAnswer,validateEvidenceAnswer,historyWithoutEvidence} from './research-evidence.js';
import {researchMessages} from './research-agent.js';
import {retrievalNotice,hybridEvidence} from './research-hybrid.js';
import {planResearchQuery} from './research-query.js';
const text='A short start. '+Array.from({length:40},(_,i)=>'word'+i).join(' ')+'.';
const evidence=[{id:'E1',title:'Original A',text,page:2,lineStart:5,lineEnd:9},{id:'E2',title:'Original B',text}];
test('excerpt reaches at least ten words across a short opening, clips long sources and preserves exact prefix',()=>{
 const opening=evidenceOpening(text);assert.equal(opening.split(/\s+/).length,24);assert.ok(opening.endsWith('...'));assert.ok(text.startsWith(opening.slice(0,-3)));
 assert.equal(evidenceOpening('There are only five words.'),'There are only five words.');
 assert.equal(evidenceOpening(text,3).split(/\s+/).length,10);
});
test('unknown IDs are visibly unverified, never remapped and never crash the whole answer',()=>{
 const r=groundedEvidenceAnswer('Supported [E1]. Needs checking [E99].',evidence);
 assert.deepEqual(r.sources.map(e=>e.id),['E1']);assert.deepEqual(r.invalidEvidenceIds,['E99']);assert.match(r.answer,/引用未核验：E99/);assert.match(r.answer,/对应结论需核对原文/);assert.ok(!r.answer.includes('[E99]'));assert.match(r.answer,/PDF 第 2 页/);assert.match(r.answer,/原句：/);
 const none=groundedEvidenceAnswer('Claim [E3]',[],'en');assert.equal(none.sources.length,0);assert.match(none.answer,/unverified citation/);
});
test('grouped, full-width and ranged citations resolve only against this request',()=>{
 const r=groundedEvidenceAnswer('Sources 【E1，E2】 and [E1-E3].',evidence);
 assert.deepEqual(r.sources.map(e=>e.id),['E1','E2']);assert.deepEqual(r.invalidEvidenceIds,['E3']);
 assert.throws(()=>validateEvidenceAnswer('[E1, E99]',evidence));
 assert.doesNotThrow(()=>groundedEvidenceAnswer('Range [E1-E999999999]',evidence));
});
test('history loses previous-turn citation IDs and appended evidence; current IDs are explicit',()=>{
 const old='Earlier finding [E99].\n\n证据来源：\n\n- [E99] old text';
 assert.equal(historyWithoutEvidence(old),'Earlier finding .');
 const body=JSON.parse(researchMessages([], [{role:'assistant',text:old,status:'done'}], 'Follow up',{evidence})[1].content);
 assert.deepEqual(body.allowed_evidence_ids,['E1','E2']);assert.ok(!JSON.stringify(body.recent_conversation).includes('E99'));assert.ok(!JSON.stringify(body.recent_conversation).includes('old text'));
});
test('warming and actual vector failure have distinct truthful notices; rewrite fallback remains bilingual',async()=>{
 const docs=[{node:{id:'p'},document:{markdown:'sample participants methods'}}];
 const cold=await hybridEvidence(docs,'sample',{queries:['sample']},{searchIndex:async()=>({indexedChunks:0,ranks:[]})});
 assert.equal(cold.retrieval.warningCode,'index_warming');assert.match(retrievalNotice(cold.retrieval),/后台准备/);
 const failure=await hybridEvidence(docs,'sample',{queries:['sample']},{searchIndex:async()=>{throw Error('missing model');}});
 assert.equal(failure.retrieval.warningCode,'index_unavailable');assert.match(retrievalNotice(failure.retrieval),/暂不可用/);
 const fallback=await planResearchQuery('观察方法是什么',{generate:async()=>{throw Error('offline');}});assert.equal(fallback.degraded,true);assert.match(fallback.queries.join(' '),/being watched/);
});
