import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import sample from '../../src/public-sample.js';
import {loadSampleDocument} from '../../src/sample-corpus.js';
import {buildPaperCard,validPaperCard} from '../../src/research-card.js';
import {hybridEvidence} from '../../src/research-hybrid.js';
import {adaptiveQueryPlan} from '../../src/research-query.js';
const documents=await Promise.all(sample.nodes.map(async node=>({node,document:await loadSampleDocument(node,f=>fs.readFile('public/sample-fulltext/'+f,'utf8'))})));
for(const d of documents){d.document.paperCard=buildPaperCard(d.node,d.document);assert.ok(validPaperCard(d.document.paperCard,d.document,d.node));for(const f of Object.values(d.document.paperCard.fields))if(f.evidence){const e=f.evidence;assert.equal(d.document.markdown.slice(e.startOffset,e.endOffset),e.text);}}
const q='这些文献主要研究了一个什么问题',plan=await adaptiveQueryPlan(q,{nodes:sample.nodes});
const overview=await hybridEvidence(documents,q,plan);
assert.equal(overview.retrieval.coveredPaperCount,50);assert.equal(overview.retrieval.omittedForBudget,0);
const screeningPlan=await adaptiveQueryPlan('哪些论文使用了问卷法',{nodes:sample.nodes});
const selected=new Set();let fallback=0;
for(let i=0;i<29;i+=8){const batch=documents.slice(i,Math.min(29,i+8)),r=await hybridEvidence(batch,'哪些论文使用了问卷法',screeningPlan);for(const e of r.evidence){selected.add(e.documentId);const d=documents.find(d=>d.node.id===e.documentId);assert.equal(d.document.markdown.slice(e.startOffset,e.endOffset),e.text);}fallback+=r.retrieval.fallbackPaperCount;}
const report={papers:50,cards:50,overviewSourceCoverage:overview.retrieval.coveredPaperCount,overviewCharacters:overview.retrieval.characters,screenScope:29,screenPapersWithCandidateEvidence:selected.size,cardFields:Object.fromEntries(['researchQuestion','population','methods','findings'].map(k=>[k,documents.filter(d=>d.document.paperCard.fields[k].evidence).length])),limitations:'Real source integrity/retrieval coverage only. No live answer model, no semantic precision/recall or API latency measured. Screening candidates are not verified matches.'};
await fs.mkdir('output/collection-audit',{recursive:true});await fs.writeFile('output/collection-audit/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
