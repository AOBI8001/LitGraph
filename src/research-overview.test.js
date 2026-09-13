import test from 'node:test';
import assert from 'node:assert/strict';
import {isCollectionOverview,overviewEvidence,sourceCoverage} from './research-overview.js';
import {adaptiveQueryPlan,retrievalPolicy} from './research-query.js';
import {hybridEvidence} from './research-hybrid.js';
import {researchMessages} from './research-agent.js';
const docs=n=>Array.from({length:n},(_,i)=>({node:{id:`import-${i}`,title:`Imported paper ${i}`},document:{markdown:`# Imported paper ${i}\n\n## PDF Page 1\n\n摘要\n\n本研究探讨第${i}类环境对人类行为的影响。${'通过实验考察研究问题并讨论研究边界。'.repeat(60)}\n\n## PDF Page 2\n\nResults\n\n${'Specific results and comparisons. '.repeat(100)}`,sourceKind:'pdf_text'}}));
test('collection overview intent bypasses model planning and keeps fact queries unchanged',async()=>{
 for(const q of ['这些文献主要研究了一个什么问题','这些论文主要研究什么','概括全部论文的研究主题','What are the main research questions in these papers?'])assert.ok(isCollectionOverview(q));
 for(const q of ['SSRT可靠吗','比较两篇论文样本量','这些论文的样本量分别是多少'])assert.equal(isCollectionOverview(q),false);
 assert.equal(isCollectionOverview('这些论文主要研究什么',1),false);
 const p=await adaptiveQueryPlan('这些文献主要研究了一个什么问题',{nodes:docs(50).map(d=>d.node),history:[{role:'user',text:'SSRT可靠吗'}],generate:()=>{throw Error('Must not call model');}});
 assert.equal(p.intent,'collection-overview');assert.equal(p.queries.includes('SSRT可靠吗'),false);assert.equal(retrievalPolicy(p,50).budget,42000);
});
test('imported 50-paper overview covers every paper, preserves exact excerpts and prompt metadata',async()=>{
 const documents=docs(50),q='这些文献主要研究了一个什么问题';
 const r=await hybridEvidence(documents,q,{queries:[q]},{budget:12000,topK:12,searchIndex:()=>{throw Error('No vector search for collection coverage');}});
 assert.equal(new Set(r.evidence.map(e=>e.documentId)).size,50);assert.equal(r.retrieval.fullScopeCovered,true);assert.ok(r.retrieval.characters<=42000);
 for(const e of r.evidence){const md=documents.find(d=>d.node.id===e.documentId).document.markdown;assert.equal(e.text,md.slice(e.startOffset,e.endOffset));assert.equal(e.lineStart,md.slice(0,e.startOffset).split('\n').length);assert.ok(e.text.includes('本研究'));}
 const p=JSON.parse(researchMessages(documents.map(d=>d.node),[],q,{...r,coverage:sourceCoverage(documents,r.evidence)})[1].content);
 assert.equal(p.documents.length,50);assert.equal(p.scope.papersWithRetrievedEvidence,50);assert.equal(p.scope.fullScopeRepresented,true);assert.equal(p.scope.exhaustive,false);
});
test('missing source, abstract fallback and oversized libraries are reported honestly',()=>{
 const documents=[...docs(3),{node:{id:'missing'},document:{markdown:''}},{node:{id:'abstract',abstract:'An abstract about an investigation.'},document:null}];
 const r=overviewEvidence(documents),coverage=sourceCoverage(documents,r.evidence);
 assert.equal(r.retrieval.fullScopeCovered,false);assert.equal(r.retrieval.missingSourceCount,1);
 assert.equal(coverage.find(c=>c.id==='missing').status,'no_source_text');assert.equal(coverage.find(c=>c.id==='abstract').status,'abstract_only');
 const big=overviewEvidence(docs(1500));assert.equal(big.retrieval.coveredPaperCount,120);assert.equal(big.retrieval.omittedForBudget,1380);assert.ok(big.retrieval.characters<=42000);
 const controller=new AbortController();controller.abort();assert.throws(()=>overviewEvidence(docs(2),{signal:controller.signal}));
});
test('a bare abstract heading never outranks its substantive structured abstract',()=>{
 const document={markdown:'# Title\n\nAbstract\n\nBackground.\n\n'+('This study examines inhibition in a community sample. '.repeat(25))};
 const r=overviewEvidence([{node:{id:'structured'},document}]);assert.ok(r.evidence[0].text.length>180);assert.match(r.evidence[0].text,/This study/);
});
