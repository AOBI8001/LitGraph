import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptiveQueryPlan,scopedQueryPlanMessages,questionFocus,retrievalPolicy} from './research-query.js';
import {recoverQueryCoverage} from './research-hybrid.js';
import {packEvidence} from './research-evidence.js';
const raw={queries:['sample size recruited patients healthy controls','participant age range'],high_level_keywords:[],low_level_keywords:['participants'],sections:['methods']};
test('conceptual questions remain one model call; precise facts have a larger bounded policy',async()=>{
 let calls=0;const generate=async()=>{calls++;return raw;};
 const simple=await adaptiveQueryPlan('SSRT测量抑制控制可靠吗',{generate});assert.equal(calls,0);assert.equal(retrievalPolicy(simple,50).topK,12);
 const overview=await adaptiveQueryPlan('留学生规范有哪些',{generate});assert.equal(calls,0);assert.equal(overview.detailed,false);
 const fact=await adaptiveQueryPlan('患者人数是多少',{generate,identity:'fact'});assert.equal(calls,1);assert.equal(fact.detailed,true);assert.equal(retrievalPolicy(fact,50).topK,20);assert.equal(retrievalPolicy(fact,50).budget,28000);
});
test('mid-flight cancellation settles promptly even if the planning transport ignores abort',async()=>{
 const controller=new AbortController();
 const pending=adaptiveQueryPlan('What dose was administered?',{signal:controller.signal,identity:'cancel-live',generate:()=>new Promise(()=>{}),timeoutMs:10000});
 controller.abort(new DOMException('Stopped','AbortError'));const start=performance.now();await assert.rejects(pending,/Stopped/);assert.ok(performance.now()-start<500);
});
test('planner sends only explicitly named bibliographic metadata, not the full library or prior answers',()=>{
 const nodes=[{id:'a',title:'A detailed clinical study title'},{id:'b',title:'An unrelated private study title'}];
 const messages=scopedQueryPlanMessages('针对论文《A detailed clinical study title》：招募多少人？',[{role:'assistant',text:'old E999 evidence'}],nodes),body=JSON.parse(messages[1].content);
 assert.deepEqual(body.papers.map(x=>x.id),['a']);assert.ok(!body.question.includes('clinical'));assert.ok(!JSON.stringify(messages).includes('old E999'));assert.match(questionFocus('比较《first》与《second》：分别多少人？'),/分别多少人/);
});
test('unresponsive planning times out, cancels and retains expanded fact budget; cancellation is not swallowed',async()=>{
 let aborted=false;const t=performance.now();
 const plan=await adaptiveQueryPlan('参与者年龄是多少',{identity:'hung',timeoutMs:20,generate:(_m,s)=>{s.addEventListener('abort',()=>aborted=true);return new Promise(()=>{});}});
 assert.ok(performance.now()-t<500);assert.ok(aborted);assert.ok(plan.degraded);assert.equal(retrievalPolicy(plan,50).budget,28000);
 const controller=new AbortController();controller.abort();await assert.rejects(adaptiveQueryPlan('多少人',{signal:controller.signal}));
});
test('one supplemental pass restores a missing query aspect without replacing sources or falsifying completeness',()=>{
 const candidates=[{chunkId:'a1',documentId:'a',text:'Working memory and attention were measured.',section:'discussion'},
 {chunkId:'a2',documentId:'a',text:'The sample size included 41 participants recruited from clinics.',section:'methods'},
 {chunkId:'b1',documentId:'b',text:'Working memory and attention were measured.',section:'discussion'},
 {chunkId:'b2',documentId:'b',text:'The sample size included 35 participants recruited from clinics.',section:'methods'}];
 const evidence=packEvidence([candidates[0],candidates[2]],3000,2,['a','b']);
 const r=recoverQueryCoverage(candidates,evidence,{queries:['memory','sample size participants recruited']},['a','b'],{budget:3000,topK:2});
 assert.equal(r.added,2);assert.equal(r.evidence.length,4);assert.deepEqual(r.evidence.map(e=>e.id),['E1','E2','E3','E4']);assert.ok(r.evidence.every(e=>['a','b'].includes(e.documentId)));
});
test('balanced packing preserves sources from each compared paper under a shared budget',()=>{
 const candidates=Array.from({length:20},(_,i)=>({chunkId:'a'+i,documentId:'a',text:'First source '+i})).concat(Array.from({length:20},(_,i)=>({chunkId:'b'+i,documentId:'b',text:'Second source '+i})));
 const packed=packEvidence(candidates,28000,20,['a','b']);assert.equal(packed.filter(e=>e.documentId==='a').length,10);assert.equal(packed.filter(e=>e.documentId==='b').length,10);
});

test('supplement recovers an unlabelled lead abstract and never crosses the explicit paper scope',()=>{
 const lead={chunkId:'lead',documentId:'a',section:'unknown',startOffset:100,text:'Methods: The participants included 25 patients and 25 controls. '+ 'Sample results and design. '.repeat(14)};
 const late={...lead,chunkId:'late',startOffset:12000,text:lead.text+' participants'};
 const outside={...lead,chunkId:'outside',documentId:'b'};
 const base={chunkId:'base',documentId:'a',section:'discussion',text:'The clinical interpretation.'};
 const r=recoverQueryCoverage([base,lead,late,outside],packEvidence([base],28000,20),{queries:['人数','participants sample']},['a'],{budget:28000,topK:20});
 assert.ok(r.evidence.some(e=>e.chunkId==='lead'));assert.ok(!r.evidence.some(e=>e.documentId==='b'));assert.ok(r.added<=6);
});
