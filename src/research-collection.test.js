import test from 'node:test';
import assert from 'node:assert/strict';
import {researchRoute} from './research-routing.js';
import {buildPaperCard,validPaperCard} from './research-card.js';
import {prepareCollectionRequest,normalizePaperReviews} from './research-collection-flow.js';
import {hybridEvidence} from './research-hybrid.js';
import {sourceCoverage} from './research-overview.js';
import {adaptiveQueryPlan} from './research-query.js';

const docs=n=>Array.from({length:n},(_,i)=>({node:{id:`paper-${i}`,title:`Distinct experimental source title number ${i}`},document:{markdown:`# Paper ${i}\n\n## Abstract\n\nThis study examines attention in students. ${'We investigated social observation and task performance. '.repeat(8)}\n\n## Methods\n\n${'Participants completed a questionnaire and an experimental task. '.repeat(12)}\n\n## Results\n\n${'Results showed a difference between conditions. '.repeat(10)}`,sourceKind:'markdown'}}));
test('two routes distinguish facts from coverage and obey named source scope',async()=>{
 const nodes=docs(50).map(d=>d.node);
 for(const q of ['SSRT是什么','被他人观察怎样影响抑制控制','所有人都有抑制能力吗'])assert.equal(researchRoute(q,nodes).kind,'local-fact');
 for(const q of ['这些论文讲了什么','概括全部论文的研究主题'])assert.equal(researchRoute(q,nodes).task,'overview');
 assert.equal(researchRoute('这280篇文献主要围绕哪些研究问题？',nodes).task,'overview');
 for(const q of ['哪些论文使用了问卷法','列出所有研究中的问卷使用情况','Which papers used questionnaires?'])assert.equal(researchRoute(q,nodes).task,'screen');
 assert.equal(researchRoute('比较选中的五篇论文',nodes).kind,'multi-compare');
 assert.equal(researchRoute('积极广播与抑郁和焦虑的关联如何？其作用路径是什么？',nodes.slice(0,2)).kind,'multi-compare');
 assert.equal(researchRoute('这些论文有什么共同结论',nodes).route,'coverage');
 assert.equal(researchRoute('总结全部论文的主要发现',nodes).summaryField,'findings');
 assert.equal(researchRoute('概括全部文献的方法',nodes).summaryField,'methods');
 assert.equal(researchRoute(`比较《${nodes[2].title}》和《${nodes[5].title}》的方法`,nodes).scopeIds.length,2);
 const p=await adaptiveQueryPlan('哪些论文使用了问卷法',{nodes,generate:()=>{throw Error('No routing API call');}});assert.equal(p.intent,'scope-coverage');assert.ok(p.queries.some(q=>q.includes('questionnaire')));
});
test('comparison planning decomposes the question and preserves the balanced route',async()=>{
 const nodes=docs(2).map(d=>d.node);let calls=0;
 const plan=await adaptiveQueryPlan('比较这两篇论文的样本与主要结果',{nodes,identity:'comparison-route-v3',generate:async()=>{calls++;return {queries:['sample participants in this paper','main findings in this paper'],high_level_keywords:['sample','findings'],low_level_keywords:['participants','results'],sections:['methods','results'],dimensions:[{label:'样本',query:'sample participants',paperIds:['paper-0','paper-1'],sections:['methods']},{label:'主要结果',query:'main results findings',paperIds:['paper-0','paper-1'],sections:['results']}]};}});
 assert.equal(calls,1);assert.equal(plan.kind,'multi-compare');assert.equal(plan.task,'compare');assert.equal(plan.intent,'scope-coverage');assert.equal(plan.strategy,'paper-dimension-matrix-model');assert.equal(plan.dimensions.length,2);assert.deepEqual(plan.dimensions[0].paperIds,['paper-0','paper-1']);
});
test('paper cards are exact, versioned, missing-safe and reject fabricated analysis quotations',()=>{
 const d=docs(1)[0],card=buildPaperCard(d.node,d.document,{methods:{quote:'invented '.repeat(10)}});
 assert.ok(validPaperCard(card,d.document,d.node));
 for(const f of Object.values(card.fields))if(f.evidence)assert.equal(d.document.markdown.slice(f.evidence.startOffset,f.evidence.endOffset),f.evidence.text);
 assert.equal(validPaperCard(card,{markdown:d.document.markdown+' changed'},d.node),false);
 assert.equal(validPaperCard(card,d.document,{id:'another-project-paper'}),false);
 assert.equal(buildPaperCard({id:'empty'},{markdown:''}).fields.methods.status,'not_explicit');
 const quote=card.fields.methods.evidence.text;assert.equal(buildPaperCard(d.node,d.document,{methods:{quote}}).fields.methods.selection,'analysis_quote');
});
test('per-paper retrieval cannot be dominated by a prolific paper; a miss stays uncertain',async()=>{
 const documents=docs(8);documents.push({node:{id:'missing',title:'Missing'},document:null});
 const p={intent:'scope-coverage',task:'screen',queries:['questionnaire methods']};
 const result=await hybridEvidence(documents,'哪些论文使用了问卷法',p);
 assert.equal(new Set(result.evidence.map(e=>e.documentId)).size,8);assert.equal(result.retrieval.checkedPaperCount,9);
 assert.equal(result.coverage.find(c=>c.id==='missing').status,'no_source_text');
 const bad=normalizePaperReviews({papers:[{paperId:'paper-0',status:'supported',finding:'Claim',evidenceIds:['E999']}]},documents.map(d=>d.node),result.evidence);
 assert.ok(bad.every(r=>r.status==='uncertain'));
});
test('comparison retrieves each paper-dimension cell independently and retains one source per cell',async()=>{
 const documents=docs(2),p={intent:'scope-coverage',task:'compare',queries:['attention participants','difference between conditions'],dimensions:[{label:'样本',query:'participants questionnaire',paperIds:['paper-0','paper-1'],sections:['methods']},{label:'结果',query:'difference between conditions',paperIds:['paper-0','paper-1'],sections:['results']}]};
 const result=await hybridEvidence(documents,'比较两篇研究的方法和结果',p,{perPaperCandidates:5,perPaperFinal:2});
 assert.equal(result.retrieval.method,'paper-dimension-matrix');assert.equal(result.retrieval.checkedUnitCount,4);assert.equal(result.retrieval.coveredUnitCount,4);
 assert.ok(result.evidence.length>=2&&result.evidence.length<=4);assert.ok(result.evidence.every(e=>e.comparisonDimensions.length>=1));
 assert.ok(result.retrieval.dimensionMatrix.every(cell=>cell.evidenceIds.length===1));
 assert.ok(result.coverage.every(c=>c.retrievalStatus==='candidate_evidence'));
});
test('29-paper scope processes all batches, keeps global citations and reuses completed work on retry',async()=>{
 const documents=docs(29),plan={route:'coverage',task:'screen',intent:'scope-coverage',queries:['questionnaire']};
 let calls=0;const cache=new Map(),stages=[];
 const options={nodes:documents.map(d=>d.node),question:'哪些论文使用了问卷法',plan,cache,onStage:s=>stages.push(s),
  prepare:async batch=>{const selected=documents.filter(d=>batch.some(n=>n.id===d.node.id)),r=await hybridEvidence(selected,'问卷',plan);return {...r,coverage:sourceCoverage(selected,r.evidence)};},
  generate:async messages=>{calls++;const body=JSON.parse(messages[1].content);return JSON.stringify({papers:body.documents.map(n=>({paperId:n.id,status:'supported',finding:'The study used a questionnaire.',evidenceIds:body.evidence.filter(e=>e.documentId===n.id).slice(0,1).map(e=>e.id)}))});}};
 const result=await prepareCollectionRequest(options);assert.equal(calls,4);assert.equal(result.reviewLedger.length,29);assert.equal(new Set(result.evidence.map(e=>e.id)).size,result.evidence.length);
 assert.equal(JSON.parse(result.messages[1].content).scope.papersReviewed,29);assert.ok(stages.includes('coverage:29:29'));
 await prepareCollectionRequest(options);assert.equal(calls,4);
 const c=new AbortController();c.abort();await assert.rejects(prepareCollectionRequest({...options,signal:c.signal}));
});
test('large overview batches cover all 150 papers without the old 120-paper cap',async()=>{
 const nodes=docs(150).map(d=>d.node),plan={route:'coverage',task:'overview',intent:'collection-overview'};let aggregate=0;
 const result=await prepareCollectionRequest({nodes,question:'这些文献主要研究什么',plan,
 prepare:async batch=>{const evidence=batch.map((n,i)=>({id:`E${i+1}`,documentId:n.id,title:n.title,text:'This study investigates attention in human participants.',sourceKind:'markdown'}));return {evidence,coverage:batch.map(n=>({id:n.id,status:'source_text_available_excerpts_only',suppliedEvidenceIds:evidence.filter(e=>e.documentId===n.id).map(e=>e.id)})),retrieval:{strategy:'collection-overview'}};},
 generate:async messages=>{const b=JSON.parse(messages[1].content);if(b.notes){aggregate++;return JSON.stringify({answer:'Attention research '+b.notes.map(n=>n.text.match(/\[E\d+\]/)?.[0]||'').join(' ')});}return JSON.stringify({papers:b.documents.map(n=>({paperId:n.id,status:'supported',finding:'Studies attention.',evidenceIds:b.evidence.filter(e=>e.documentId===n.id).map(e=>e.id)}))});}});
 const body=JSON.parse(result.messages[1].content);assert.equal(body.scope.papersReviewed,150);assert.equal(body.scope.fullScopeRepresented,true);assert.ok(aggregate>0);assert.equal(result.reviewLedger.length,150);
});
test('overview aggregation falls back to the cited review ledger when a synthesis drops citations',async()=>{
 const nodes=docs(61).map(d=>d.node),plan={kind:'collection-overview',route:'coverage',task:'overview',intent:'collection-overview'};
 const result=await prepareCollectionRequest({nodes,question:'这些论文主要研究什么',plan,
  prepare:async batch=>{const evidence=batch.map((n,i)=>({id:`E${i+1}`,documentId:n.id,title:n.title,text:'This study investigates attention in human participants.',sourceKind:'markdown'}));return {evidence,coverage:sourceCoverage(batch.map(node=>({node,document:{markdown:'source'}})),evidence),retrieval:{strategy:'collection-overview'}};},
  generate:async messages=>{const b=JSON.parse(messages[1].content);if(b.notes)return JSON.stringify({answer:'Summary without any citation.'});return JSON.stringify({papers:b.documents.map(n=>({paperId:n.id,status:'supported',finding:'Studies attention.',evidenceIds:b.evidence.filter(e=>e.documentId===n.id).map(e=>e.id)}))});}});
 const body=JSON.parse(result.messages[1].content);assert.ok(body.collection_reviews.length>0);assert.match(body.collection_reviews[0].text,/\[E\d+\]/);
});
test('failed or incomplete model batches never claim complete review',async()=>{
 const nodes=docs(9).map(d=>d.node);
 const r=await prepareCollectionRequest({nodes,question:'哪些论文使用访谈',plan:{route:'coverage',task:'screen'},prepare:async batch=>({evidence:[],coverage:batch.map(n=>({id:n.id,suppliedEvidenceIds:[],status:'no_source_text'})),retrieval:{}}),generate:async()=>{throw Error('offline');}});
 assert.equal(JSON.parse(r.messages[1].content).scope.papersReviewed,0);assert.match(r.coverageNotice,/9 篇处理失败/);
});
