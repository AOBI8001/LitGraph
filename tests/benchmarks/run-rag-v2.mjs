import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {cases,documents,metrics} from './rag-v2-cases.mjs';
import {queryPlanMessages,normalizeQueryPlan} from '../../src/research-query.js';
import {hybridEvidence,RAG_TOP_K} from '../../src/research-hybrid.js';
import {researchMessages} from '../../src/research-agent.js';
import {validateEvidenceAnswer,evidenceLocations} from '../../src/research-evidence.js';
import {embed} from './local-embedder.mjs';
import {runAgent,findAgent} from '../../desktop/agent-runtime.mjs';
const out=path.resolve('output/rag-benchmark-v2');await fs.mkdir(out,{recursive:true});await fs.mkdir(path.join(out,'agent-work'),{recursive:true});
const hash=x=>createHash('sha256').update(x).digest('hex'),goldHash=hash(JSON.stringify(cases));
const files=['src/research-evidence.js','src/research-query.js','src/research-hybrid.js','src/research-embedding.js','src/research-agent.js'];
const settings={name:'LitGraph-RAG-50 v2',nodes:50,uniquePapers:49,questions:75,primary:69,comparisons:20,topK:RAG_TOP_K,budget:28000,mode:'quick',maxTokens:8192,provider:'Codex CLI default (model ID undisclosed)',goldHash,corpusHash:hash(await fs.readFile('public/sample-fulltext/index.json')),codeHashes:Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await fs.readFile(f))]))),tuning:JSON.parse(await fs.readFile('output/rag-v2-development/sweep.json')),retries:0,concurrency:2};
await fs.writeFile(path.join(out,'gold.json'),JSON.stringify(cases,null,2));await fs.writeFile(path.join(out,'settings.json'),JSON.stringify(settings,null,2));
const executable=await findAgent('codex');let cursor=0,done=0;
async function work(){while(cursor<cases.length){const c=cases[cursor++],file=path.join(out,c.id+'.json'),old=await fs.readFile(file,'utf8').then(JSON.parse).catch(()=>null);if(old){if(old.goldHash!==goldHash)throw Error('Gold changed');console.log(c.id,'saved');done++;continue;}
 const record={id:c.id,question:c.question,expected:c.expected,category:c.category,goldHash},start=Date.now();
 try{
  let t=Date.now();record.planRaw=await runAgent({provider:'codex',executable,messages:queryPlanMessages(c.question,[],documents.map(x=>x.node)),maxTokens:1500,mode:'quick',cwd:path.join(out,'agent-work'),timeoutMs:90000});record.plan=normalizeQueryPlan(record.planRaw,c.question);record.planSeconds=(Date.now()-t)/1000;
  t=Date.now();record.context=await hybridEvidence(documents,c.question,record.plan,{embed,topK:RAG_TOP_K});record.retrievalSeconds=(Date.now()-t)/1000;if(record.context.retrieval.warning)throw Error(record.context.retrieval.warning);
  record.metrics=metrics(record.context.evidence,c.gold);record.context.coverage=documents.map(({node})=>({id:node.id,status:'fulltext_indexed_excerpts_only',suppliedEvidenceIds:record.context.evidence.filter(e=>e.documentId===node.id).map(e=>e.id)}));
  record.messages=researchMessages(documents.map(x=>x.node),[],c.question,record.context,'quick');t=Date.now();record.raw=await runAgent({provider:'codex',executable,messages:record.messages,maxTokens:8192,mode:'quick',cwd:path.join(out,'agent-work'),timeoutMs:180000});record.answerSeconds=(Date.now()-t)/1000;
  record.parsed=JSON.parse(record.raw);record.sources=validateEvidenceAnswer(record.parsed.answer,record.context.evidence).map(({text,...e})=>e);record.displayAnswer=evidenceLocations(record.parsed.answer,record.context.evidence,'zh');
 }catch(error){record.error=error.message;}
 record.totalSeconds=(Date.now()-start)/1000;await fs.writeFile(file,JSON.stringify(record,null,2));console.log(JSON.stringify({id:c.id,done:++done,total:cases.length,error:record.error,seconds:record.totalSeconds,recall:record.metrics&&[record.metrics.recovered,record.metrics.goldUnits]}));
}}
await Promise.all([work(),work()]);
