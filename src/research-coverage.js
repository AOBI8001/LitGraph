import {sourceCoverage} from './research-overview.js';

// Run the existing retriever inside EACH paper's boundary. A miss is unknown,
// never proof of absence. Called on bounded batches by the UI orchestration.
export async function coverageEvidence(documents,question,plan,{retrieve,signal,budget=42000}={}){
 const perPaper=Array(documents.length);let cursor=0;
 await Promise.all(Array.from({length:Math.min(3,documents.length)},async()=>{
  while(cursor<documents.length){signal?.throwIfAborted();const i=cursor++;
   perPaper[i]=await retrieve([documents[i]],question,{...plan,intent:'fact',route:'relevance'},
    {budget:Math.min(6000,Math.floor(budget/Math.max(1,documents.length))),topK:4,retrievalTimeoutMs:1200,supplement:false,signal});
  }
 }));
 const evidence=perPaper.flatMap(r=>r.evidence).map((e,i)=>({...e,id:`E${i+1}`}));
 return {evidence,coverage:sourceCoverage(documents,evidence),retrieval:{strategy:'scope-coverage',method:'per-paper-hybrid',task:plan.task,
  checkedPaperCount:documents.length,coveredPaperCount:new Set(evidence.map(e=>e.documentId)).size,scopePaperCount:documents.length,
  fullScopeCovered:documents.every(d=>evidence.some(e=>e.documentId===d.node.id)),exhaustive:false,
  fallbackPaperCount:perPaper.filter(r=>r.retrieval?.warning).length,omittedForBudget:0}};
}

export function coverageNotice(r={},language='zh'){
 if(!['scope-coverage','collection-overview'].includes(r.strategy))return '';
 const failed=r.failedPaperCount||0;
 // Routine retrieval statistics belong to diagnostics, not every answer.
 // Preserve genuine failures rather than presenting an incomplete run as done.
 if(!failed)return '';
 return language==='en'?`${failed} papers could not be analyzed; their findings remain unconfirmed.`:`有 ${failed} 篇处理失败，其结论尚未确认。`;
}
