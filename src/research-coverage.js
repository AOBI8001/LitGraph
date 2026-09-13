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
 const total=r.scopePaperCount||0,covered=r.coveredPaperCount||0,reviewed=r.reviewedPaperCount??covered;
 return language==='en'
  ?`Scope: ${total} papers; source excerpts supplied for ${covered}; ${reviewed} represented in analysis; ${r.failedPaperCount||0} failed. This is excerpt-based coverage, not an exhaustive full-text audit. A retrieval miss does not prove absence.`
  :`范围：${total} 篇；已提供原文或摘要摘录 ${covered} 篇；纳入分析 ${reviewed} 篇；处理失败 ${r.failedPaperCount||0} 篇。按摘录覆盖，不代表逐字审阅全文；未检索到不能判断为不存在。${r.fallbackPaperCount?` ${r.fallbackPaperCount} 篇检索使用了关键词或部分就绪向量降级。`:''}`;
}
