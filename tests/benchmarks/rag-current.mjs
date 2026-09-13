import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {cases as formalCases,development,documents,metrics} from './rag-v2-cases.mjs';
import {adaptiveQueryPlan,retrievalPolicy} from '../../src/research-query.js';
import {hybridEvidence} from '../../src/research-hybrid.js';
import {researchMessages} from '../../src/research-agent.js';
import {groundedEvidenceAnswer,evidenceOpening} from '../../src/research-evidence.js';
import {createVectorService} from '../../scripts/rag-vector-service.mjs';
import {runAgent,findAgent} from '../../desktop/agent-runtime.mjs';
const dev=process.argv.includes('--development');
const cases=dev?development:formalCases;
const hash=x=>createHash('sha256').update(x).digest('hex');
await fs.mkdir('output',{recursive:true});
const out=await fs.mkdtemp(path.resolve('output/rag-benchmark-126-'));
await fs.mkdir(path.join(out,'agent-work'));
const baseline={goldHash:'d80629de930b402afde865086b7db6744f7a28a48b62718f24a950b9790a7638',corpusHash:'7d5c4d59d492dc53f7abe1d64db55a2a45af5cc79f9a4af1bd27caee5a7696f2'};
const goldHash=hash(JSON.stringify(cases)),corpusHash=hash(await fs.readFile('public/sample-fulltext/index.json'));
if(!dev&&(goldHash!==baseline.goldHash||corpusHash!==baseline.corpusHash))throw Error('Frozen corpus/questions differ from baseline');
const files=['src/research-evidence.js','src/research-query.js','src/research-hybrid.js','src/research-agent.js','scripts/rag-index.mjs','scripts/rag-vector-worker.mjs','desktop/agent-runtime.mjs'];
const settings={name:'LitGraph-RAG-50 v2 / current 1.2.6',createdAt:new Date().toISOString(),version:JSON.parse(await fs.readFile('package.json')).version,goldHash,corpusHash,questions:cases.length,primary:dev?12:69,goldUnits:dev?16:89,concurrency:2,retries:0,mode:'quick',policy:'adaptive facts: 20/28000 + one bounded coverage pass (up to 6 extra chunks/8400 characters); concepts: 12/12000; planning timeout 16s',maxTokens:8192,provider:'Codex CLI current default (precise model ID unavailable)',cache:'fresh isolated user cache; bundled sample vectors indexed before questions; query model initially cold',timing:'backend plan+retrieval+complete answer, excludes initial corpus loading/indexing and UI queue/rendering',codeHashes:Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await fs.readFile(f))])))};
await fs.writeFile(path.join(out,'settings.json'),JSON.stringify(settings,null,2));
await fs.writeFile(path.join(out,'gold.json'),JSON.stringify(cases,null,2));
console.log('OUTPUT '+out);
for(const d of documents)d.node={...d.node,fulltextKey:hash(`sample-md:${d.node.id}:${d.document.corpusHash}`)};
const vector=createVectorService(process.cwd(),out),executable=await findAgent('codex');
try{
 const start=Date.now();let status;
 while(Date.now()-start<120000){status=await vector.index('status');if(status.ready===50)break;await new Promise(r=>setTimeout(r,300));}
 await fs.writeFile(path.join(out,'index-ready.json'),JSON.stringify({seconds:(Date.now()-start)/1000,status},null,2));
 if(status.ready!==50)throw Error('Sample index did not complete');
 console.log(JSON.stringify({indexReady:status.ready,chunks:status.completedChunks,seconds:(Date.now()-start)/1000}));
 let cursor=0,done=0;const wall=Date.now();
 async function work(){while(cursor<cases.length){
  const c=cases[cursor++],record={id:c.id,category:c.category,question:c.question,expected:c.expected,goldHash},started=performance.now();
  try{
   let t=performance.now();record.plan=await adaptiveQueryPlan(c.question,{nodes:documents.map(d=>d.node),identity:'bench126',generate:(messages,signal)=>runAgent({provider:'codex',executable,messages,maxTokens:700,mode:'quick',signal,cwd:path.join(out,'agent-work'),timeoutMs:18000})});record.planSeconds=(performance.now()-t)/1000;
   t=performance.now();record.context=await hybridEvidence(documents,c.question,record.plan,{...retrievalPolicy(record.plan,documents.length,'quick'),searchIndex:(documents,queries,signal)=>vector.index('search',{documents,queries},signal)});record.retrievalSeconds=(performance.now()-t)/1000;
   record.metrics=metrics(record.context.evidence,c.gold);
   record.context.coverage=documents.map(({node})=>({id:node.id,status:'fulltext_indexed_excerpts_only',suppliedEvidenceIds:record.context.evidence.filter(e=>e.documentId===node.id).map(e=>e.id)}));
   if(dev){record.totalSeconds=(performance.now()-started)/1000;await fs.writeFile(path.join(out,c.id+'.json'),JSON.stringify(record,null,2));console.log(JSON.stringify({id:c.id,planSeconds:record.planSeconds,recall:record.metrics,degraded:record.plan.degraded,supplement:record.context.retrieval.supplement}));done++;continue;}
   record.messages=researchMessages(documents.map(d=>d.node),[],c.question,record.context,'quick');t=performance.now();
   record.raw=await runAgent({provider:'codex',executable,messages:record.messages,maxTokens:8192,mode:'quick',cwd:path.join(out,'agent-work'),timeoutMs:180000,onPartial:()=>{record.firstPartialSeconds??=(performance.now()-started)/1000;}});record.answerSeconds=(performance.now()-t)/1000;
   record.parsed=JSON.parse(record.raw.replace(/^```(?:json)?\s*|\s*```$/g,''));
   const grounded=groundedEvidenceAnswer(record.parsed.answer,record.context.evidence,'zh');record.displayAnswer=grounded.answer;record.invalidEvidenceIds=grounded.invalidEvidenceIds;record.sources=grounded.sources.map(({text,...e})=>({...e,opening:evidenceOpening(text)}));
  }catch(error){record.error=error.message;}
  record.totalSeconds=(performance.now()-started)/1000;
  await fs.writeFile(path.join(out,c.id+'.json'),JSON.stringify(record,null,2));
  console.log(JSON.stringify({id:c.id,done:++done,total:cases.length,error:record.error,seconds:record.totalSeconds,recall:record.metrics&&[record.metrics.recovered,record.metrics.goldUnits],method:record.context?.retrieval.method,warning:record.context?.retrieval.warningCode}));
 }}
 await Promise.all([work(),work()]);
 await fs.writeFile(path.join(out,'run-complete.json'),JSON.stringify({wallSeconds:(Date.now()-wall)/1000,completed:done,finishedAt:new Date().toISOString()},null,2));
}finally{await vector.close();}
