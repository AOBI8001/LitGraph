import fs from 'node:fs/promises';
import path from 'node:path';
import {documents,cases,metrics} from './rag-v2-cases.mjs';
import {quickQueryPlan,needsModelQueryPlan,retrievalPolicy} from '../../src/research-query.js';
import {hybridEvidence} from '../../src/research-hybrid.js';
import {researchMessages} from '../../src/research-agent.js';
import {createVectorService} from '../../scripts/rag-vector-service.mjs';
import {runAgent,findAgent} from '../../desktop/agent-runtime.mjs';
const folder=await fs.mkdtemp(path.resolve('output/research-latency-'));
const nativeEmbed=createVectorService(process.cwd(),folder);
const embed=async(texts,kind,signal)=>{const vectors=[];for(let i=0;i<texts.length;i+=128)vectors.push(...await nativeEmbed(texts.slice(i,i+128),kind,signal));return vectors;};
const question='ssrt来测量抑制控制可靠吗';
const results=[];
if(process.argv.includes('--retrieval-only')){
 const {embed:regressionEmbed}=await import('./local-embedder.mjs');
 for(const item of cases.filter(c=>c.gold.length&&c.category!=='duplicate-control')){
  const frozen=JSON.parse(await fs.readFile(path.join('output/rag-benchmark-v2',item.id+'.json'),'utf8'));
  const plan=needsModelQueryPlan(item.question,documents.map(d=>d.node))?frozen.plan:quickQueryPlan(item.question);
  const start=performance.now(),result=await hybridEvidence(documents,item.question,plan,{embed:regressionEmbed,...retrievalPolicy(plan,documents.length,'quick')});
  const score=metrics(result.evidence,item.gold);results.push({id:item.id,...score,ms:performance.now()-start});
  console.log(item.id,score.recovered+'/'+score.goldUnits);
 }
 console.log(JSON.stringify({gold:results.reduce((n,r)=>n+r.goldUnits,0),recovered:results.reduce((n,r)=>n+r.recovered,0),badcases:results.filter(r=>r.recovered<r.goldUnits).map(r=>r.id)}));
}else{
 const executable=await findAgent('codex');
 for(const [label,scope] of [['all-cold',documents],['single-first',[documents[49]]],['all-warm',documents],['single-warm',[documents[49]]],['all-repeat',documents],['single-repeat',[documents[49]]]]){
  const start=performance.now(),plan=quickQueryPlan(question),context=await hybridEvidence(scope,question,plan,{embed,...retrievalPolicy(plan,scope.length,'quick')});
  const retrievalMs=performance.now()-start,messages=researchMessages(scope.map(d=>d.node),[],question,context,'quick');
  try{
   const answer=await runAgent({provider:'codex',executable,messages,maxTokens:8192,mode:'quick',cwd:folder,timeoutMs:90000});
   const result={label,papers:scope.length,retrievalMs,answerMs:performance.now()-start-retrievalMs,totalMs:performance.now()-start,inputCharacters:JSON.stringify(messages).length,retrieval:context.retrieval,evidence:context.evidence,answer};
   results.push(result);console.log(JSON.stringify({...result,evidence:undefined,answer:undefined}));
  }catch(error){results.push({label,retrievalMs,totalMs:performance.now()-start,error:error.message});console.log(label,error.message);}
  await fs.writeFile(path.join(folder,'results.json'),JSON.stringify(results,null,2));
 }
}
await fs.writeFile(path.join(folder,'results.json'),JSON.stringify(results,null,2));
console.log('Report:',folder);
