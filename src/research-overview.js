import {makeCandidates} from './research-evidence.js';
import {validPaperCard} from './research-card.js';

// Collection synthesis is a coverage task, not a global top-K fact lookup.
export function isCollectionOverview(question, paperCount=2) {
 if(paperCount<2)return false;
 const q=String(question);
 if(/(?:这些|这批|全部|所有).{0,12}(?:论文|文献|研究).{0,12}(?:讲了什么|讨论什么|研究什么|共同主题)/.test(q))return true;
 return /(?:这些|这批|全部|所有|整体|总体|文献库|论文库|本项目).{0,30}(?:主要研究|研究.{0,8}(?:问题|主题|方向)|共同.{0,8}(?:问题|主题)|概括|概览|综述|总结)/.test(q)
  || /(?:概括|概览|总结|综述).{0,20}(?:这些|这批|全部|所有|文献库|论文库)/.test(q)
  || /(?:主要|共同|核心).{0,6}研究(?:了|的是|的)?(?:一个|什么|哪些|了什么|什么样的)/.test(q)
  || /\b(?:overview|summari[sz]e|main research (?:questions?|themes?|topics?)|common research question)\b.*\b(?:papers|studies|collection|library|literature)\b|\b(?:papers|studies|collection|library|literature)\b.*\b(?:main|overall|overview|research questions?|themes?)\b/i.test(q);
}

const aim=/\b(?:we\s+(?:aim\w*|investigat\w*|examin\w*|test\w*|explor\w*|found|conduct\w*)|this\s+(?:study|paper|research|review)|the\s+(?:present|current)\s+(?:study|review)|objectives?\s*:|(?:purpose|aim)\s+of\s+(?:this|the\s+present)|to\s+investigate)\b|本(?:研究|文)|研究目的|旨在|探讨|考察/i;
function priority(c) {
 const substantive=c.text.length>=180;
 return (substantive?10:-200)+(c.section==='abstract'?80:0)
  +(c.section==='introduction'?20:0)+(aim.test(c.text)?35:0)
  +(c.startOffset<3000?65:c.startOffset<7000?20:0)+(c.section==='conclusion'?10:0)
  -(c.section==='references'?200:0)-((c.text.match(/https?:\/\/|copyright|ISSN|DOI:/gi)||[]).length*3);
}
function clipSource(chunk, limit) {
 if(chunk.text.length<=limit)return {...chunk,truncated:false};
 // Preserve an exact contiguous source slice, preferably containing the aim.
 const match=aim.exec(chunk.text);let start=match&&match.index>limit*.6?match.index:0;
 // Avoid a tiny tail or a mid-word crop; keep the preceding sentence if needed.
 if(start&&chunk.text.length-start<180){const boundaries=[...chunk.text.slice(0,start).matchAll(/[.!?。！？](?:\s|$)/g)];start=(boundaries.at(-1)?.index??-1)+1;}
 let end=Math.min(chunk.text.length,start+limit);
 if(end<chunk.text.length){const part=chunk.text.slice(start,end),boundary=[...part.matchAll(/[.!?。！？](?:\s|$)/g)].filter(m=>m.index>limit*.5).at(-1);if(boundary)end=start+boundary.index+1;}
 const text=chunk.text.slice(start,end),offset=(chunk.startOffset||0)+start;
 return {...chunk,text,startOffset:offset,endOffset:offset+text.length,
  lineStart:(chunk.lineStart||1)+(chunk.text.slice(0,start).match(/\n/g)||[]).length,
  lineEnd:(chunk.lineStart||1)+(chunk.text.slice(0,end).match(/\n/g)||[]).length,
  chunkId:chunk.chunkId+`:overview:${start}-${end}`,truncated:true};
}
export function overviewEvidence(documents,{budget=42000,signal,summaryField='researchQuestion'}={}) {
 const started=performance.now(),all=makeCandidates(documents),byDocument=new Map();
 for(const c of all){if(c.section==='references'||!/[\p{L}\p{N}]/u.test(c.text))continue;const list=byDocument.get(c.documentId)||[];list.push(c);byDocument.set(c.documentId,list);}
 const available=documents.filter(d=>byDocument.has(d.node.id));
 // Avoid unbounded prompts for huge imports. Report omitted papers explicitly.
 const cap=Math.min(120,Math.max(1,Math.floor(budget/350))),count=Math.min(cap,available.length);
 const quota=Math.min(1000,Math.floor(budget/Math.max(1,count))),evidence=[];
 for(const {node,document} of available.slice(0,count)){
  signal?.throwIfAborted();const score=c=>priority(c)+(summaryField==='findings'&&['results','conclusion'].includes(c.section)?150:0)+(summaryField==='methods'&&c.section==='methods'?150:0);const ranked=byDocument.get(node.id).sort((a,b)=>score(b)-score(a)||a.startOffset-b.startOffset);
  const card=document?.paperCard;
  const cached=validPaperCard(card,document,node)?card.fields[summaryField]?.evidence:null;
  // Only reuse source-matching excerpts from a card for this exact document.
  const selected=cached&&document.markdown.slice(cached.startOffset,cached.endOffset)===cached.text?cached:ranked[0];
  evidence.push({...clipSource(selected,quota),id:`E${evidence.length+1}`});
 }
 return {evidence,retrieval:{method:'per-document-source-overview',strategy:'collection-overview',
  scopePaperCount:documents.length,availablePaperCount:available.length,coveredPaperCount:evidence.length,
  omittedForBudget:Math.max(0,available.length-evidence.length),missingSourceCount:documents.length-available.length,
  fullScopeCovered:evidence.length===documents.length,exhaustive:false,chunkCount:evidence.length,
  characters:evidence.reduce((n,e)=>n+e.text.length,0),timings:{totalMs:performance.now()-started}}};
}

export function sourceCoverage(documents,evidence){return documents.map(({node,document})=>({
 id:node.id,title:node.title,
 status:document?.markdown?.trim()?'source_text_available_excerpts_only':node.abstract?.trim()?'abstract_only':'no_source_text',
 suppliedEvidenceIds:evidence.filter(e=>e.documentId===node.id).map(e=>e.id)
}));}
