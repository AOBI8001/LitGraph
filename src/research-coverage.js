import {sourceCoverage} from './research-overview.js';
import {lexicalRank} from './research-evidence.js';

// Run the existing retriever inside EACH paper's boundary. A miss is unknown,
// never proof of absence. Called on bounded batches by the UI orchestration.
export async function coverageEvidence(documents,question,plan,{retrieve,signal,budget=42000,perPaperCandidates=5,perPaperFinal=2}={}){
 if(plan.task==='compare'&&plan.dimensions?.length)return comparisonMatrixEvidence(documents,question,plan,{retrieve,signal,budget,perPaperCandidates});
 const perPaper=Array(documents.length);let cursor=0;
 await Promise.all(Array.from({length:Math.min(3,documents.length)},async()=>{
  while(cursor<documents.length){signal?.throwIfAborted();const i=cursor++;
   const subqueries=(plan.queries||[question]).map(q=>`For this paper only: ${q}`);
   perPaper[i]=await retrieve([documents[i]],question,{...plan,intent:'fact',route:'relevance',task:'fact',queries:subqueries},
    {budget:Math.min(7500,Math.max(4200,Math.floor(budget/Math.max(1,documents.length)))),topK:perPaperCandidates,retrievalTimeoutMs:1200,supplement:true,signal});
   // Supplemental aspect recovery may produce more than five internal hits.
   // Re-rank them against all decomposed subqueries and keep a bounded 3–5
   // candidate pool before the balanced final selection.
   const ranked=lexicalRank(perPaper[i].evidence,subqueries.join(' ')).map(r=>r.chunk);
   perPaper[i].evidence=ranked.slice(0,perPaperCandidates);
  }
 }));
 const candidatePool=perPaper.flatMap(r=>r.evidence),query=[question,...(plan.queries||[])].join(' '),evidence=[];
 // Re-rank within each paper, then reserve the same final allowance for every
 // paper. This prevents a prolific paper from occupying another paper's slots.
 for(const {node} of documents){
  const own=candidatePool.filter(e=>e.documentId===node.id),ranked=lexicalRank(own,query).map(r=>r.chunk);
  evidence.push(...ranked.slice(0,Math.max(1,perPaperFinal)));
 }
 evidence.forEach((e,i)=>e.id=`E${i+1}`);
 const candidateCounts=Object.fromEntries(documents.map(({node},i)=>[node.id,perPaper[i]?.evidence?.length||0]));
 const coverage=sourceCoverage(documents,evidence).map(entry=>({...entry,retrievalStatus:candidateCounts[entry.id]>0?'candidate_evidence':'insufficient_evidence'}));
 return {evidence,coverage,retrieval:{strategy:'scope-coverage',method:'per-paper-subquery+balanced-rerank',task:plan.task,
  checkedPaperCount:documents.length,coveredPaperCount:new Set(evidence.map(e=>e.documentId)).size,scopePaperCount:documents.length,
  fullScopeCovered:documents.every(d=>evidence.some(e=>e.documentId===d.node.id)),exhaustive:false,
  perPaperCandidates,perPaperFinal,candidateCounts,insufficientPaperIds:documents.filter(({node})=>!candidateCounts[node.id]).map(({node})=>node.id),
  fallbackPaperCount:perPaper.filter(r=>r.retrieval?.warning).length,omittedForBudget:0}};
}

// A comparison is not one large Top-K competition. It is a matrix of bounded
// paper x requested-dimension searches. Each cell retrieves independently and
// contributes at most one best source excerpt; duplicate excerpts can satisfy
// more than one cell without being repeated in the model context.
async function comparisonMatrixEvidence(documents,question,plan,{retrieve,signal,budget=42000,perPaperCandidates=5}={}){
 const ids=new Set(documents.map(({node})=>node.id)),dimensions=plan.dimensions.map((d,index)=>({
  id:`D${index+1}`,label:d.label||`aspect ${index+1}`,query:d.query,paperIds:(d.paperIds?.length?d.paperIds:[...ids]).filter(id=>ids.has(id)),sections:d.sections||[]
 })).filter(d=>d.query&&d.paperIds.length),units=[];
 for(const dimension of dimensions)for(const paperId of dimension.paperIds)units.push({dimension,paperId});
 const results=Array(units.length);let cursor=0;
 await Promise.all(Array.from({length:Math.min(4,units.length)},async()=>{
  while(cursor<units.length){signal?.throwIfAborted();const i=cursor++,unit=units[i],document=documents.find(d=>d.node.id===unit.paperId);
   const subPlan={...plan,intent:'fact',route:'relevance',task:'fact',queries:[unit.dimension.query],high_level_keywords:[],low_level_keywords:[],sections:unit.dimension.sections};
   // Candidate breadth is internal only: the model still receives one excerpt
   // per matrix cell. A broad local pool is needed because exact numerical
   // answers often live in an early abstract while repeated topic words occur
   // throughout discussion and references.
   const result=await retrieve([document],unit.dimension.query,subPlan,{budget:90000,topK:Math.max(60,perPaperCandidates),retrievalTimeoutMs:1800,supplement:true,signal});
   const best=rankDimensionEvidence(result.evidence,unit.dimension)[0]?.chunk;
   results[i]={...unit,result,best};
  }
 }));
 const selected=new Map();
 for(const row of results)if(row.best){const existing=selected.get(row.best.chunkId);if(existing)existing.comparisonDimensions.push(row.dimension.id);else selected.set(row.best.chunkId,{...row.best,comparisonDimensions:[row.dimension.id]});}
 const evidence=[...selected.values()];evidence.forEach((e,i)=>e.id=`E${i+1}`);
 const matrix=results.map(row=>({dimensionId:row.dimension.id,dimension:row.dimension.label,paperId:row.paperId,status:row.best?'evidence_found':'insufficient_evidence',evidenceIds:row.best?[selected.get(row.best.chunkId).id]:[]}));
 const candidateCounts=Object.fromEntries(documents.map(({node})=>[node.id,results.filter(r=>r.paperId===node.id).reduce((n,r)=>n+(r.result?.evidence?.length||0),0)]));
 const coverage=sourceCoverage(documents,evidence).map(entry=>({...entry,retrievalStatus:matrix.some(cell=>cell.paperId===entry.id&&cell.status==='evidence_found')?'candidate_evidence':'insufficient_evidence'}));
 return {evidence,coverage,retrieval:{strategy:'scope-coverage',method:'paper-dimension-matrix',task:'compare',dimensions:dimensions.map(({id,label,query,paperIds})=>({id,label,query,paperIds})),dimensionMatrix:matrix,
  checkedPaperCount:documents.length,checkedUnitCount:units.length,coveredUnitCount:matrix.filter(c=>c.status==='evidence_found').length,coveredPaperCount:new Set(evidence.map(e=>e.documentId)).size,scopePaperCount:documents.length,
  fullScopeCovered:documents.every(d=>evidence.some(e=>e.documentId===d.node.id)),exhaustive:false,perDimensionFinal:1,candidateCounts,
  insufficientUnits:matrix.filter(c=>c.status==='insufficient_evidence').map(c=>({dimensionId:c.dimensionId,paperId:c.paperId})),fallbackPaperCount:new Set(results.filter(r=>r.result?.retrieval?.warning).map(r=>r.paperId)).size,omittedForBudget:0}};
}

function rankDimensionEvidence(evidence,dimension){
 const q=`${dimension.label} ${dimension.query}`,ranked=lexicalRank(evidence,q),norm=Math.max(1,ranked[0]?.score||1),text=`${dimension.label} ${dimension.query}`.toLowerCase();
 const wantsAge=/年龄|岁|\bage\b|years? old|age range/.test(text),wantsSample=/样本|人数|参与者|被试|多少|sample|participants?|subjects?|how many|number of/.test(text),wantsGroups=/各组|两组|每组|分别|诊断和人数|each group|per group|groups? and number|group sizes?|patients? and (?:healthy )?controls?|diagnostic groups|controls? counts?/.test(text),wantsPairs=/双胞胎|配对|pairs?|twins?|monozygotic|\bmz\b/.test(text),wantsDose=/剂量|dose|dosage|\bmg\b/.test(text),wantsDuration=/多久|时长|秒|分钟|duration|seconds?|minutes?/.test(text),wantsStudyCount=/几项|多少项|研究数量|number of studies|studies included/.test(text),wantsDefinition=/测量什么|什么任务|what does|measure|assess|probe/.test(text),wantsEffect=/影响|效应|效果|结论|结果|effect|influence|result|finding/.test(text),wantsArticulation=/发音|复述|articulation|pronunciation|rehearsal/.test(text);
 return ranked.map((item,index)=>{const source=item.chunk.text;let feature=0;
  feature+=item.chunk.startOffset<2500?1.25:item.chunk.startOffset<6500?.75:item.chunk.startOffset<12000?.25:0;
  if(item.chunk.section==='abstract')feature+=.45;else if(item.chunk.section==='introduction')feature+=.15;else if(item.chunk.section==='references')feature-=2;
  if(wantsAge&&(/(?:age range|ages? (?:of|between)|aged)\D{0,20}\d/i.test(source)||/\d+\s*[–—-]\s*\d+\s*(?:years?|岁)/i.test(source)))feature+=1.8;
  if(wantsSample&&(/\bn\s*=\s*\d+/i.test(source)||/\b(?:all\s+)?\d+\s+(?:\w+[ -]){0,3}(?:participants?|subjects?|patients?|controls?|adults?|children)\b/i.test(source)||/\b(?:participants?|subjects?|patients?|controls?)\s*\(\s*n\s*=\s*\d+/i.test(source)))feature+=2.4;
  if(wantsSample&&/\b(?:final sample|sample (?:comprised|consisted|included)|participants consisted|recruit(?:ment|ed)|were included|measured.{0,35}from)\b[^.\n]{0,90}\d+/i.test(source))feature+=1.2;
  const flat=source.replace(/\s+/g,' ');
  if(wantsGroups&&((flat.match(/\b(?:OCD|SAD|TD|ADHD|patients?|controls?|group)\b[^.]{0,35}\bn\s*=\s*\d+/gi)||[]).length>=2||(flat.match(/\b\d+\s+(?:[\w-]+\s+){0,4}(?:patients?|controls?|participants?|subjects?|individuals?|adults?)\b/gi)||[]).length>=2))feature+=3.2;
  if(wantsGroups){const labelled=(source.match(/\bn\s*=\s*\d[\d,]*/gi)||[]).length;if(labelled>=2)feature+=Math.min(2.5,labelled*.5);}
  if(wantsPairs&&(/\b\d+\s+(?:mz|monozygotic)(?:\s+twin)?\s+pairs?\b/i.test(source)||/\b(?:mz|monozygotic)\b[^.\n]{0,80}\b\d+\s+(?:twin\s*)?pairs?\b/i.test(source)))feature+=3.4;
  else if(wantsPairs&&/\d+\D{0,18}\b(?:twin\s*)?pairs?\b/i.test(source))feature+=1.1;
  if(wantsDose&&(/\d+(?:\.\d+)?\s*(?:mg|µg|ug|g)\b/i.test(source)))feature+=1.8;
  if(wantsDuration&&(/\d+(?:\.\d+)?\s*(?:s|sec(?:onds?)?|min(?:utes?)?|小时|分钟|秒)\b/i.test(source)))feature+=1.5;
  if(wantsStudyCount&&/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:separate\s+)?stud(?:y|ies)\b/i.test(source))feature+=2.1;
  if(wantsDefinition&&/\b(?:measure[sd]?|assess(?:es|ed)?|probe[sd]?|considered to|used to (?:measure|assess|test))\b/i.test(source))feature+=1.25;
  if(wantsEffect&&/\b(?:increase[sd]?|decrease[sd]?|facilitat(?:e[sd]?|ion)|improv(?:e[sd]?|ement)|impair(?:ed|ment)?|significant(?:ly)?|no (?:effect|difference)|did not)\b/i.test(source))feature+=1.1;
  if(wantsArticulation){for(const term of ['silent','aloud','whisper','concurrent articulation','verbal rehearsal'])if(source.toLowerCase().includes(term))feature+=.65;}
  if(/\btable\s+\d+/i.test(source)&&(source.match(/\d+/g)||[]).length>18&&!/\bn\s*=\s*\d+/i.test(source))feature-=2.5;
  if(dimension.sections?.includes(item.chunk.section))feature+=.25;
  return {...item,score:item.score/norm+feature-index*.002};
 }).sort((a,b)=>b.score-a.score);
}

export function coverageNotice(r={},language='zh'){
 if(!['scope-coverage','collection-overview'].includes(r.strategy))return '';
 const failed=r.failedPaperCount||0;
 // Routine retrieval statistics belong to diagnostics, not every answer.
 // Preserve genuine failures rather than presenting an incomplete run as done.
 if(!failed)return '';
 return language==='en'?`${failed} papers could not be analyzed; their findings remain unconfirmed.`:`有 ${failed} 篇处理失败，其结论尚未确认。`;
}
