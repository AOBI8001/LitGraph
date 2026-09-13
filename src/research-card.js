import {chunkDocument,fingerprint} from './research-evidence.js';

export const PAPER_CARD_VERSION='source-card-v1';
const fields={
 researchQuestion:/\b(?:aim|purpose|objective|investigat|examin|this study|present study)\w*|研究目的|旨在|本研究|本文|探讨/i,
 population:/\b(?:participants?|patients?|subjects?|sample|children|adolescents?|adults?)\b|被试|参与者|研究对象|样本|患者|学生/i,
 methods:/\b(?:methods?|procedure|design|experiment|questionnaire|meta-analysis)\b|研究方法|实验|问卷|元分析|访谈/i,
 findings:/\b(?:results?|findings?|we found|showed|demonstrated|conclusion)\b|结果|发现|结论|表明/i
};
export function validPaperCard(card,document,node){
 return card?.version===PAPER_CARD_VERSION&&card.documentId===node.id&&card.sourceHash===fingerprint(document.markdown||node.abstract||'');
}
// Exact source excerpts, not an additional model-generated summary. Unknown
// fields stay unknown; old papers can be upgraded without an API request.
export function buildPaperCard(node,document,modelFields={}){
 const source=document.markdown||node.abstract||'',chunks=document.markdown?chunkDocument(document,node):[];
 const usable=chunks.filter(c=>c.section!=='references'&&c.text.length>=100);
 const card={version:PAPER_CARD_VERSION,documentId:node.id,sourceHash:fingerprint(source),fields:{}};
 const excerpt=(c,start=0,end=Math.min(c.text.length,900))=>({...c,text:c.text.slice(start,end),startOffset:c.startOffset+start,endOffset:c.startOffset+end,
  lineStart:c.lineStart+(c.text.slice(0,start).match(/\n/g)||[]).length,lineEnd:c.lineStart+(c.text.slice(0,end).match(/\n/g)||[]).length,truncated:start>0||end<c.text.length});
 for(const [field,pattern] of Object.entries(fields)){
  const quote=typeof modelFields?.[field]?.quote==='string'?modelFields[field].quote.trim():'';
  const matched=quote.length>=40&&quote.length<=1600&&!quote.includes('[unmapped PDF symbol]')?usable.find(c=>c.text.includes(quote)):null;
  if(matched){const start=matched.text.indexOf(quote);card.fields[field]={status:'source_excerpt',selection:'analysis_quote',evidence:excerpt(matched,start,start+quote.length)};continue;}
  const ranked=usable.filter(c=>pattern.test(c.text)).sort((a,b)=>{
   const score=c=>(c.section==='abstract'?50:0)+(field==='researchQuestion'&&c.startOffset<6000?35:0)+(field==='methods'&&c.section==='methods'?60:0)+(field==='findings'&&['results','conclusion'].includes(c.section)?60:0)-(c.startOffset>source.length*.9?10:0);
   return score(b)-score(a)||a.startOffset-b.startOffset;
  });
  const c=ranked[0];
  if(!c){card.fields[field]={status:'not_explicit'};continue;}
  const index=pattern.exec(c.text)?.index||0;
  const boundary=[...c.text.slice(0,index).matchAll(/[.!?。！？]\s+/g)].at(-1);
  const start=index>600?(boundary?boundary.index+boundary[0].length:0):0;
  card.fields[field]={status:'source_excerpt',selection:'local_candidate_not_semantically_verified',evidence:excerpt(c,start,Math.min(c.text.length,start+900))};
 }
 return card;
}
