import assert from 'node:assert/strict';
import test from 'node:test';
import {chunkDocument,makeCandidates,packEvidence,evidenceLocations} from './research-evidence.js';
import {normalizeQueryPlan,planResearchQuery,quickQueryPlan,needsModelQueryPlan,retrievalPolicy} from './research-query.js';
import {hybridEvidence} from './research-hybrid.js';
import {createEmbedder} from './research-embedding.js';
test('paragraph chunks preserve offsets, metadata, sections, long sentences and pages',()=>{
 const document={markdown:'# Title\n\n## PDF Page 2\n\nMethods\n\n'+('Participants completed a stop signal task. '.repeat(100))+'\n\n## PDF Page 3\nResults\n\nN = 42.\n',sourceKind:'pdf_text'},node={id:'p',title:'Title',authors:['A','B'],year:2024};
 const chunks=chunkDocument(document,node);assert.ok(chunks.length>4);for(const c of chunks){assert.equal(document.markdown.slice(c.startOffset,c.endOffset),c.text);assert.ok(c.text.length<=1400);assert.deepEqual(c.authors,['A','B']);}const result=chunks.find(c=>c.text.includes('N = 42'));assert.equal(result.page,3);assert.equal(result.section,'results');assert.equal(result.year,2024);assert.equal(new Set(chunks.map(c=>c.chunkId)).size,chunks.length);
});
test('query schema bounds expansion, caches only valid plans and propagates abort',async()=>{
 const raw={queries:['how many participants?'],high_level_keywords:['sample size'],low_level_keywords:['participants'],sections:['methods','invented']};assert.deepEqual(normalizeQueryPlan(raw,'人数?').sections,['methods']);let calls=0;const opts={identity:'unit',generate:async()=>{calls++;return raw;}};await planResearchQuery('人数?',opts);await planResearchQuery('人数?',opts);assert.equal(calls,1);const controller=new AbortController();controller.abort();await assert.rejects(planResearchQuery('x',{...opts,signal:controller.signal}));
});
test('hybrid selects explicit papers, keeps whole chunks and records fallback',async()=>{
 const docs=['A detailed paper title','Another detailed paper title','Unrelated paper title'].map((title,i)=>({node:{id:String(i),title},document:{markdown:'## PDF Page 1\nMethods\n\nSample participants number '+(20+i)+'.'}}));
 const q='Compare A detailed paper title and Another detailed paper title sample size',plan={queries:[q],sections:['methods']};
 const result=await hybridEvidence(docs,q,plan,{topK:4,searchIndex:async()=>({indexedChunks:2,ranks:[makeCandidates(docs).map(c=>({chunkId:c.chunkId,score:1}))]})});assert.equal(result.retrieval.method,'bm25+ready-dense+rrf+feature-rerank');assert.deepEqual(new Set(result.evidence.map(e=>e.documentId)),new Set(['0','1']));assert.ok(result.evidence.every(e=>!e.truncated));assert.match(evidenceLocations('Fact [E1]',result.evidence,'en'),/PDF page 1/);
 const fallback=await hybridEvidence(docs,q,plan,{searchIndex:async()=>{throw Error('missing model');}});assert.match(fallback.retrieval.warning,/keyword-only fallback/);
});
test('embedding cache reuses unchanged text and isolates query/passage and changes',async()=>{
 let count=0;const disk=new Map(),embed=createEmbedder({load:async()=>async texts=>{count+=texts.length;return {tolist:()=>texts.map(()=>Array(384).fill(1/Math.sqrt(384)))};},read:async k=>disk.get(k),write:async(k,v)=>disk.set(k,v)});
 await embed(['old','new']);await embed(['old','changed']);assert.equal(count,3);await embed(['old'],'query');assert.equal(count,4);
});
test('quick local expansion preserves the question and adds search terms without inventing facts',()=>{
 const p=quickQueryPlan('SSRT测量抑制控制可靠吗');assert.equal(p.strategy,'local-fast');assert.match(p.queries.join(' '),/reliability/);assert.equal(p.queries[0],'SSRT测量抑制控制可靠吗');assert.equal(p.degraded,undefined);
 assert.match(quickQueryPlan('它的样本多大',[{role:'user',text:'SSRT研究'}]).queries.join(' '),/SSRT研究/);
});
test('quick searches only ready vectors, never generates passage vectors, and cancellation propagates',async()=>{
 const docs=Array.from({length:4},(_,i)=>({node:{id:'p'+i,title:'Paper '+i},document:{markdown:Array.from({length:50},(_,j)=>`Reliability sample participants in study ${i} paragraph ${j}.`).join('\n\n')}}));
 let passages=0;const embed=async(texts,kind)=>{if(kind==='passage')passages=texts.length;return texts.map(()=>[1,0]);};
 const result=await hybridEvidence(docs,'reliability',quickQueryPlan('reliability'),{embed,...retrievalPolicy(quickQueryPlan('reliability'),4)});assert.equal(passages,0);assert.ok(result.evidence.length<=12);assert.equal(result.retrieval.strategy,'ready-index-only');
 await hybridEvidence(docs,'reliability',quickQueryPlan('reliability'),{embed,mode:'expert'});assert.equal(passages,0);
 const controller=new AbortController();controller.abort();await assert.rejects(hybridEvidence(docs,'reliability',quickQueryPlan('reliability'),{embed,mode:'quick',signal:controller.signal}));
});
test('detailed, numerical and comparison questions retain model rewriting and full evidence budget',()=>{
 for(const q of ['比较两篇论文的发现','患者人数是多少','针对论文《A detailed study》：方法有哪些？'])assert.equal(needsModelQueryPlan(q),true);
 assert.equal(needsModelQueryPlan('SSRT测量抑制控制可靠吗'),false);
 assert.equal(retrievalPolicy({queries:['question']},50,'expert').topK,24);
 assert.equal(retrievalPolicy({queries:['question']},50,'quick').topK,12);
 assert.equal(retrievalPolicy(quickQueryPlan('可靠?'),1).budget,8000);
});
test('duplicate input is encoded once, including within an uncached batch',async()=>{
 let count=0;const embed=createEmbedder({load:async()=>async texts=>{count+=texts.length;return {tolist:()=>texts.map(()=>Array(384).fill(.5))};}});
 const vectors=await embed(['same','same','different']);assert.equal(count,2);assert.deepEqual(vectors[0],vectors[1]);
});
