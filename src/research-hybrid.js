import {makeCandidates,explicitTargets,lexicalRank,packEvidence,fingerprint} from './research-evidence.js';
export const RAG_TOP_K=20;
export async function hybridEvidence(documents,question,plan,{searchIndex,budget=28000,topK=RAG_TOP_K,signal,retrievalTimeoutMs=3500}={}){
 const started=performance.now();signal?.throwIfAborted();
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
 const evidence=packEvidence(ranked.map(x=>x.chunk),budget,topK,targets);
 return {evidence,retrieval:{method:vectorUsed?'bm25+ready-dense+rrf+feature-rerank':'bm25+rrf+feature-rerank',strategy:'ready-index-only',denseCandidateCount:indexedChunks,timings:{lexicalMs,totalMs:performance.now()-started},topK,targets,queries,candidateCount:candidates.length,warning,warningCode,rewritingDegraded:!!plan.degraded,chunkCount:evidence.length,characters:evidence.reduce((n,e)=>n+e.text.length,0)}};
}
export function retrievalNotice(retrieval={},plan={},language='zh'){
 const en=language==='en';
 if(retrieval.warningCode==='index_warming')return en?'The background index is still preparing. This answer uses keyword search and any ready vectors.':'向量索引正在后台准备，本次先使用关键词和已就绪向量检索。';
 if(retrieval.warningCode==='retrieval_timeout')return en?'Vector search reached its time budget. Continuing with keyword evidence without waiting.':'向量检索达到本次时间预算，已使用关键词证据继续回答，无需等待。';
 if(retrieval.warning)return en?'Local vector search is unavailable. This answer uses keyword evidence; restart the app if this persists.':'本地向量检索暂不可用，本次使用关键词证据；若持续出现，请重启软件后再试。';
 if(plan.degraded)return en?'Query rewriting was unavailable. Using local search-term expansion.':'检索词改写未完成，本次使用本地关键词扩展。';
 return '';
}
