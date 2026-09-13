import {makeCandidates,explicitTargets,lexicalRank,packEvidence,fingerprint} from './research-evidence.js';
import {isCollectionOverview,overviewEvidence} from './research-overview.js';
import {coverageEvidence} from './research-coverage.js';
export const RAG_TOP_K=20;
export async function hybridEvidence(documents,question,plan,{searchIndex,budget=28000,topK=RAG_TOP_K,signal,retrievalTimeoutMs=3500,supplement=false}={}){
 const started=performance.now();signal?.throwIfAborted();
 if(plan.intent==='collection-overview'||(!plan.intent&&isCollectionOverview(question,documents.length)))return overviewEvidence(documents,{budget:Math.max(budget,42000),signal,summaryField:plan.summaryField});
 if(plan.intent==='scope-coverage')return coverageEvidence(documents,question,plan,{signal,budget,retrieve:(docs,q,p,opts)=>hybridEvidence(docs,q,p,{...opts,searchIndex})});
 const targets=explicitTargets(documents,question),all=makeCandidates(documents),candidates=targets.length?all.filter(c=>targets.includes(c.documentId)):all;
 if(!candidates.length)return {evidence:[],retrieval:{method:'empty',targets}};
 const queries=[...new Set([...(plan.queries||[question]),[...(plan.high_level_keywords||[]),...(plan.low_level_keywords||[])].join(' ')].filter(Boolean))],fused=new Map(),bm=new Map(),dense=new Map();
 const merge=ranking=>ranking.slice(0,60).forEach(({chunk,score},i)=>{if(score<=0)return;fused.set(chunk.chunkId,(fused.get(chunk.chunkId)||0)+1/(60+i+1));});
 for(const q of queries){const rank=lexicalRank(candidates,q);merge(rank);const max=rank[0]?.score||1;for(const x of rank)bm.set(x.chunk.chunkId,Math.max(bm.get(x.chunk.chunkId)||0,x.score/max));}
 const lexicalMs=performance.now()-started;
 let warning='',warningCode='',vectorUsed=false,indexedChunks=0;
 // Never build passage vectors while answering, even for a cold index.
 if(searchIndex){const controller=new AbortController();let timer;
  const querySignal=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
  try{const scope=documents.filter(d=>(!targets.length||targets.includes(d.node.id))&&(d.node.fulltextKey||d.document?.key)&&d.document?.markdown).map(d=>({key:d.node.fulltextKey||d.document.key,id:d.node.id,hash:fingerprint(d.document.markdown.replace(/\r\n/g,'\n'))}));
   const remaining=Math.max(1,retrievalTimeoutMs-(performance.now()-started));
   const result=await Promise.race([searchIndex(scope,queries,querySignal),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Index lookup time budget exceeded'));},remaining);})]);
   signal?.throwIfAborted();indexedChunks=result.indexedChunks||0;const known=new Map(candidates.map(c=>[c.chunkId,c]));
   for(const rank of result.ranks||[]){merge(rank.filter(r=>known.has(r.chunkId)).map(r=>({chunk:known.get(r.chunkId),score:r.score})));for(const r of rank)if(known.has(r.chunkId))dense.set(r.chunkId,Math.max(dense.get(r.chunkId)||0,r.score));}
   vectorUsed=indexedChunks>0;
   if(indexedChunks<candidates.length){warningCode='index_warming';warning='全文向量索引正在后台准备；本次使用已就绪索引与关键词检索，不等待补建。';}
  }catch(error){signal?.throwIfAborted();warningCode=controller.signal.aborted?'retrieval_timeout':'index_unavailable';warning='Index unavailable or time budget exceeded; keyword-only fallback. '+error.message;}
  finally{clearTimeout(timer);controller.abort();}
 }
 const maxF=Math.max(...fused.values(),.001);
 // Feature reranker: RRF + keyword score + dense cosine + requested section. Not a cross-encoder.
 const ranked=candidates.filter(c=>fused.has(c.chunkId)).map(chunk=>({chunk,score:.45*(fused.get(chunk.chunkId)/maxF)+.35*(bm.get(chunk.chunkId)||0)+.2*(dense.get(chunk.chunkId)||0)+(plan.sections?.includes(chunk.section)?.12:0)-(chunk.section==='references'?.35:0)-(chunk.text.length<90?.15:0)})).sort((a,b)=>b.score-a.score);
 let evidence=packEvidence(ranked.map(x=>x.chunk),budget,topK,targets);
 const recovery=supplement?recoverQueryCoverage(candidates,evidence,plan,targets,{signal,budget,topK}):{evidence,added:0,checked:0};
 evidence=recovery.evidence;
 return {evidence,retrieval:{method:vectorUsed?'bm25+ready-dense+rrf+feature-rerank':'bm25+rrf+feature-rerank',strategy:'ready-index-only',denseCandidateCount:indexedChunks,timings:{lexicalMs,totalMs:performance.now()-started},topK,targets,queries,candidateCount:candidates.length,warning,warningCode,rewritingDegraded:!!plan.degraded,supplement:{rounds:recovery.checked?1:0,checked:recovery.checked,added:recovery.added,exhaustive:false},chunkCount:evidence.length,characters:evidence.reduce((n,e)=>n+e.text.length,0)}};
}

// A single, local-only safety pass for query aspects underrepresented in the
// packed context. This is a retrieval heuristic, NOT a factual-answer verifier.
// Never call a model, re-embed passages, cross the user scope or loop on misses.
export function recoverQueryCoverage(candidates,evidence,plan,targets,{signal,budget,topK,timeBudgetMs=500}={}){
 const start=performance.now(),selected=new Set(evidence.map(e=>e.chunkId)),extra=[];
 const scopes=targets.length?targets.slice(0,6):[null];
 const queries=[...new Set((plan.queries||[]).slice(1).filter(q=>q.trim()))].slice(0,3);let checked=0;
 for(const target of scopes){let perPaper=0;
  // Source abstracts often state the design/sample directly, while methods add
  // exclusions and subgroups. Keep one matching overview when detailed ranking
  // has selected only methods/discussion; never manufacture an abstract.
  if(target&&extra.length<6&&performance.now()-start<timeBudgetMs){
   // Some PDF converters flatten a structured abstract into the unlabelled
   // opening. Include matching lead paragraphs without changing source offsets
   // or invalidating the prebuilt vector index. Never treat an arbitrary late
   // "unknown" paragraph as an abstract.
   const overviews=lexicalRank(candidates.filter(c=>c.documentId===target&&c.text.length>300&&(c.section==='abstract'||(c.section==='unknown'&&c.startOffset<5000))),queries.join(' ')).filter(r=>r.score>0).slice(0,2);
   for(const overview of overviews)if(!selected.has(overview.chunk.chunkId)&&extra.length<6){extra.push(overview.chunk);selected.add(overview.chunk.chunkId);perPaper++;}
  }
  for(const query of queries){signal?.throwIfAborted();if(performance.now()-start>=timeBudgetMs||extra.length>=6)break;
   const ranked=lexicalRank(candidates.filter(c=>(!target||c.documentId===target)&&c.section!=='references'),query);
   checked++;const best=ranked[0];
   if(best?.score>0&&!selected.has(best.chunk.chunkId)&&perPaper<3){extra.push(best.chunk);selected.add(best.chunk.chunkId);perPaper++;}
  }
 }
 const result=extra.length?packEvidence([...evidence,...extra],Math.min(48000,budget+8400),topK+6,targets):evidence;
 const prior=new Set(evidence.map(e=>e.chunkId));
 return {evidence:result,added:result.filter(e=>!prior.has(e.chunkId)).length,checked};
}
export function retrievalNotice(retrieval={},plan={},language='zh'){
 const en=language==='en';
 if(retrieval.warningCode==='index_warming')return en?'The background index is still preparing. This answer uses keyword search and any ready vectors.':'向量索引正在后台准备，本次先使用关键词和已就绪向量检索。';
 if(retrieval.warningCode==='retrieval_timeout')return en?'Vector search reached its time budget. Continuing with keyword evidence without waiting.':'向量检索达到本次时间预算，已使用关键词证据继续回答，无需等待。';
 if(retrieval.warning)return en?'Local vector search is unavailable. This answer uses keyword evidence; restart the app if this persists.':'本地向量检索暂不可用，本次使用关键词证据；若持续出现，请重启软件后再试。';
 if(plan.degraded)return en?'Query rewriting was unavailable. Using local search-term expansion.':'检索词改写未完成，本次使用本地关键词扩展。';
 return '';
}
