import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { goldRows, negativeRows } from './rag-gold.mjs';
import sample from '../../src/public-sample.js';
import { loadSampleDocument } from '../../src/sample-corpus.js';
import { selectEvidence } from '../../src/research-evidence.js';
import { researchMessages } from '../../src/research-agent.js';
import { researchModePolicy } from '../../src/research-mode.js';
import { researchTokenBudget } from '../../src/ai-response.js';
import { runAgent, findAgent } from '../../desktop/agent-runtime.mjs';
const root = process.cwd(), output = path.join(root, 'output/rag-benchmark');
const execute = process.argv.includes('--model');
await fs.mkdir(output, {recursive:true});
await fs.mkdir(path.join(output, 'agent-work'), {recursive:true});
const hash = value => createHash('sha256').update(value).digest('hex');
const corpus = await fs.readFile('public/sample-fulltext/index.json','utf8');
const documents = await Promise.all(sample.nodes.map(async node => ({node,document:await loadSampleDocument(node,file=>fs.readFile('public/sample-fulltext/'+file,'utf8'))})));
const flat = text => text.toLowerCase().replace(/\s/g,'');
function goldSpan(number,start,end) {
 const id='paper-'+String(number).padStart(3,'0'), source=documents.find(d=>d.node.id===id).document.markdown;
 const positions=[...source.matchAll(/\S/g)].map(m=>m.index), normalized=flat(source);
 const a=normalized.indexOf(flat(start));
 const b=a<0?-1:normalized.indexOf(flat(end),a);
 if(a<0||b<0)throw Error('Gold passage not found for '+id+': '+(a<0?start:end));
 const left=positions[a],right=positions[b+flat(end).length-1]+1;
 return {documentId:id,canonicalId:number===46?'paper-045':id,start:left,end:right,text:source.slice(left,right),
  lineStart:source.slice(0,left).split('\n').length,lineEnd:source.slice(0,right).split('\n').length};
}
const cases=goldRows.map(([number,question,expected,start,end])=>{
 const documentId='paper-'+String(number).padStart(3,'0'),node=sample.nodes.find(n=>n.id===documentId);
 return {id:'Q'+String(number).padStart(2,'0'),category:number===46?'duplicate-control':'single-fact',documentId,
  question:`针对论文《${node.title}》：${question} 请简短回答，只回答所问事实；证据不足请明确说明。`,
  expected,gold:[goldSpan(number,start,end)]};
});
for(const [id,a,b,question]of [
 ['C01',7,11,'比较两篇研究的 OCD 患者及健康对照样本量，按论文分别给出。'],
 ['C02',13,15,'分别给出两篇研究的各组样本量，并说明后一篇是否包含未患病一级亲属。'],
 ['C03',26,32,'第一篇用什么装置让人相信被观察，第二篇实验2增加了什么操作阻止言语复述？'],
 ['C04',20,24,'这两篇研究的 OCD 患者样本量分别是多少？'],
 ['C05',39,44,'这两篇研究的样本量分别是多少？前者年龄范围和后者同卵双胞胎对数是多少？']]) {
 const first=cases.find(c=>c.id==='Q'+String(a).padStart(2,'0')),second=cases.find(c=>c.id==='Q'+String(b).padStart(2,'0'));
 cases.push({id,category:'cross-paper',question:`比较《${sample.nodes[a-1].title}》与《${sample.nodes[b-1].title}》：${question} 请简短回答，证据不足请说明。`,
  expected:first.expected+'；'+second.expected,gold:[...first.gold,...second.gold]});
}
for(const [id,question,expected]of negativeRows)cases.push({id,category:'unanswerable',question,expected,gold:[]});
const settings={benchmark:'LitGraph-RAG-50 v1',softwareVersion:JSON.parse(await fs.readFile('package.json')).version,
 gitCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 corpusSha256:hash(corpus),goldSha256:hash(JSON.stringify(cases)),nodes:50,uniquePapers:49,cases:cases.length,
 primaryAnswerable:54,duplicateControl:1,unanswerable:5,scope:'all 50 nodes',mode:'quick',
 evidenceBudget:researchModePolicy('quick').evidenceBudget,maxTokens:researchTokenBudget({},'quick'),
 provider:'Codex CLI via product runAgent',model:'provider default; exact model ID not exposed by product adapter',
 repeats:1,retries:0,timeoutMs:180000,
 codeHashes:Object.fromEntries(await Promise.all(['src/research-evidence.js','src/research-agent.js','src/research-mode.js','desktop/agent-runtime.mjs'].map(async f=>[f,hash(await fs.readFile(f))]))),
 caveats:['Self-authored internal benchmark; not independent expert annotation.', 'Minimal gold passages are not exhaustive relevance labels.',
 'Single-fact questions mainly use directly stated facts, not exhaustive synthesis.', 'No optimization or prompt change during baseline.']};
await fs.writeFile(path.join(output,'gold.json'),JSON.stringify(cases,null,2));
await fs.writeFile(path.join(output,'settings.json'),JSON.stringify(settings,null,2));
function retrievalMetrics(evidence,gold){
 if(!gold.length)return null;
 let relevant=0;const coverage=gold.map(()=>[]);
 for(const e of evidence){
  const origin=documents.find(d=>d.node.id===e.documentId)?.document.markdown;
  if(!origin)continue;
  const lineOffset=origin.split('\n').slice(0,Math.max(0,(e.lineStart||1)-1)).join('\n').length;
  const start=origin.indexOf(e.text,lineOffset),end=start+e.text.length;
  if(start<0)throw Error('Cannot locate retrieved chunk');
  let hit=false;
  gold.forEach((g,index)=>{
   const canonical=e.documentId==='paper-046'?'paper-045':e.documentId;
   if(canonical!==g.canonicalId)return;
   const a=Math.max(start,g.start),b=Math.min(end,g.end);
   if(b>a){coverage[index].push([a,b]);if(b-a>=Math.min(20,(g.end-g.start)/2))hit=true;}
  });
  if(hit)relevant++;
 }
 const ratios=coverage.map((ranges,i)=>{
  ranges.sort((a,b)=>a[0]-b[0]);let length=0,end=-1;
  for(const[a,b]of ranges){length+=Math.max(0,b-Math.max(end,a));end=Math.max(end,b);}
  return length/(gold[i].end-gold[i].start);
 });
 return {goldUnits:gold.length,recovered:ratios.filter(r=>r>=.8).length,recall:ratios.filter(r=>r>=.8).length/gold.length,
  spanCoverage:ratios,precision:relevant/evidence.length,relevantChunks:relevant,retrievedChunks:evidence.length};
}
const retrieval=cases.map(c=>{
 const evidence=selectEvidence(documents,c.question,settings.evidenceBudget);
 const scoped=c.documentId?selectEvidence(documents.filter(d=>d.node.id===c.documentId),c.question,settings.evidenceBudget):null;
 return {id:c.id,category:c.category,evidence,metrics:retrievalMetrics(evidence,c.gold),
  selectedPaperControl:scoped?retrievalMetrics(scoped,c.gold):null};
});
await fs.writeFile(path.join(output,'retrieval.json'),JSON.stringify(retrieval,null,2));
console.log(JSON.stringify({stage:'frozen',cases:cases.length,settingsHash:hash(JSON.stringify(settings)),output}));
if(!execute)process.exit(0);
const executable=await findAgent('codex');
let done=0;
for(const c of cases){
 const resultPath=path.join(output,c.id+'.json');
 const old=await fs.readFile(resultPath,'utf8').then(JSON.parse).catch(()=>null);
 if(old?.goldSha256===settings.goldSha256){console.log(JSON.stringify({id:c.id,state:'saved',done:++done,total:cases.length}));continue;}
 if(old)throw Error('Existing result belongs to another gold set; use a new output directory.');
 const retrieved=retrieval.find(r=>r.id===c.id),evidence=retrieved.evidence;
 const coverage=documents.map(({node})=>({id:node.id,status:'fulltext_indexed_excerpts_only',suppliedEvidenceIds:evidence.filter(e=>e.documentId===node.id).map(e=>e.id)}));
 const messages=researchMessages(sample.nodes,[],c.question,{evidence,coverage},'quick');
 const start=Date.now();let result,usage,reportedModel,error;
 const launch=(...args)=>{
  const child=spawn(...args);let buffer='';
  child.stdout.on('data',part=>{buffer+=part.toString();let newline;while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);try{const event=JSON.parse(line);if(event.type==='turn.completed')usage=event.usage;if(event.model)reportedModel=event.model;}catch{}}});
  return child;
 };
 try {const raw=await runAgent({provider:'codex',executable,messages,maxTokens:settings.maxTokens,mode:'quick',
  cwd:path.join(output,'agent-work'),timeoutMs:settings.timeoutMs,launch});result={raw};try{result.parsed=JSON.parse(raw);}catch{}}
 catch(e){error=e.message;}
 const record={id:c.id,category:c.category,goldSha256:settings.goldSha256,question:c.question,expected:c.expected,
  durationSeconds:(Date.now()-start)/1000,messages,usage,reportedModel,result,error};
 await fs.writeFile(resultPath,JSON.stringify(record,null,2));
 console.log(JSON.stringify({id:c.id,state:error?'error':'answered',seconds:record.durationSeconds,done:++done,total:cases.length}));
}
