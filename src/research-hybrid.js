import {makeCandidates,explicitTargets,lexicalRank,packEvidence} from './research-evidence.js';
export const RAG_TOP_K=20;
const cosine=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export async function hybridEvidence(documents,question,plan,{embed,budget=28000,topK=RAG_TOP_K,signal}={}){
 const started=performance.now();
 const targets=explicitTargets(documents,question),all=makeCandidates(documents),candidates=targets.length?all.filter(c=>targets.includes(c.documentId)):all;
 if(!candidates.length)return {evidence:[],retrieval:{method:'empty',targets}};
 const queries=[...new Set([...(plan.queries||[question]),[...(plan.high_level_keywords||[]),...(plan.low_level_keywords||[])].join(' ')].filter(Boolean))],fused=new Map(),bm=new Map(),dense=new Map();
 const merge=ranking=>ranking.slice(0,60).forEach(({chunk,score},i)=>{if(score<=0)return;fused.set(chunk.chunkId,(fused.get(chunk.chunkId)||0)+1/(60+i+1));});
 for(const q of queries){const rank=lexicalRank(candidates,q);merge(rank);const max=rank[0]?.score||1;for(const x of rank)bm.set(x.chunk.chunkId,Math.max(bm.get(x.chunk.chunkId)||0,x.score/max));}
 const lexicalMs=performance.now()-started;
 let warning='',vectorUsed=false;
 if(embed)try{signal?.throwIfAborted();const [vectors,qvectors]=await Promise.all([embed(candidates.map(c=>`${c.heading||''}\n${c.text}`),'passage',signal),embed(queries,'query',signal)]);signal?.throwIfAborted();for(const q of qvectors){const rank=candidates.map((chunk,i)=>({chunk,score:cosine(q,vectors[i])})).sort((a,b)=>b.score-a.score);merge(rank);for(const r of rank)dense.set(r.chunk.chunkId,Math.max(dense.get(r.chunk.chunkId)||0,r.score));}vectorUsed=true;}catch(error){signal?.throwIfAborted();warning='Local embedding unavailable; keyword-only fallback. '+error.message;}
 const maxF=Math.max(...fused.values(),.001);
 // Feature reranker: RRF + keyword score + dense cosine + requested section. Not a cross-encoder.
 const ranked=candidates.filter(c=>fused.has(c.chunkId)).map(chunk=>({chunk,score:.45*(fused.get(chunk.chunkId)/maxF)+.35*(bm.get(chunk.chunkId)||0)+.2*(dense.get(chunk.chunkId)||0)+(plan.sections?.includes(chunk.section)?.12:0)-(chunk.section==='references'?.35:0)-(chunk.text.length<90?.15:0)})).sort((a,b)=>b.score-a.score);
 const evidence=packEvidence(ranked.map(x=>x.chunk),budget,topK,targets);
 return {evidence,retrieval:{method:vectorUsed?'bm25+dense+rrf+feature-rerank':'bm25+rrf+feature-rerank',strategy:'full-dense',denseCandidateCount:candidates.length,timings:{lexicalMs,totalMs:performance.now()-started},topK,targets,queries,candidateCount:candidates.length,warning,rewritingDegraded:!!plan.degraded,chunkCount:evidence.length,characters:evidence.reduce((n,e)=>n+e.text.length,0)}};
}
